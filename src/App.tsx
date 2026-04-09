import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Database from "@tauri-apps/plugin-sql";
import "./App.css";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface GeminiChunk {
  chunk: string;
  stream: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSpawning, setIsSpawning] = useState(false);
  const [isSpawned, setIsSpawned] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  
  const [fileList, setFileList] = useState<string[]>([]);
  const [showFileSuggestions, setShowFileSuggestions] = useState(false);
  const [fileFilter, setFileFilter] = useState("");
  const [db, setDb] = useState<Database | null>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      try {
        const _db = await Database.load("sqlite:geminix.db");
        await _db.execute(
          "CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT, content TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)"
        );
        setDb(_db);
        const saved = await _db.select<Message[]>("SELECT role, content FROM messages ORDER BY id");
        if (saved && saved.length > 0) {
          setMessages(saved);
        }
      } catch (e) {
        console.error("DB Init Error:", e);
      }
      invoke<string[]>("list_files").then(setFileList).catch(console.error);
    }
    init();
  }, []);

  useEffect(() => {
    let unlisten: any;
    
    async function setupListener() {
      unlisten = await listen<GeminiChunk>("gemini-chunk", (event) => {
        if (event.payload.stream === "stderr") {
           console.error("Gemini Error:", event.payload.chunk);
           return;
        }
        
        try {
          const data = JSON.parse(event.payload.chunk);
          if (data.type === "message" && data.role === "assistant") {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant" && data.delta) {
                const updated = [...prev];
                updated[updated.length - 1] = { ...last, content: last.content + data.content };
                return updated;
              } else {
                return [...prev, { role: "assistant", content: data.content }];
              }
            });
          } else if (data.type === "tool_use") {
             setMessages((prev) => [...prev, { role: "assistant", content: `[Using Tool: ${data.tool_name}]` }]);
          }
        } catch (e) {
          // ignore non-json
        }
      });
    }

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const atIndex = input.lastIndexOf("@");
    if (atIndex !== -1) {
      const textAfterAt = input.slice(atIndex + 1);
      if (!textAfterAt.includes(" ")) {
        setShowFileSuggestions(true);
        setFileFilter(textAfterAt);
      } else {
        setShowFileSuggestions(false);
      }
    } else {
      setShowFileSuggestions(false);
    }
  }, [input]);

  async function startGemini(resume: boolean = false) {
    setIsSpawning(true);
    try {
      await invoke("spawn_gemini", { model: selectedModel, resume });
      setIsSpawned(true);
    } catch (e) {
      console.error(e);
      alert("Failed to spawn Gemini: " + e);
    } finally {
      setIsSpawning(false);
    }
  }

  async function saveToDb(role: string, content: string) {
    if (db) {
       await db.execute("INSERT INTO messages (role, content) VALUES (?, ?)", [role, content]);
    }
  }

  async function handleSend() {
    if (!input.trim()) return;
    const userMsg = input;
    setInput("");
    
    if (userMsg.startsWith("!")) {
       const cmdStr = userMsg.slice(1);
       setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
       saveToDb("user", userMsg);
       try {
         const res = await invoke<string>("run_shell", { command: cmdStr });
         setMessages((prev) => [...prev, { role: "system", content: res || "[No output]" }]);
         saveToDb("system", res || "[No output]");
       } catch (e) {
         setMessages((prev) => [...prev, { role: "system", content: "Error running command: " + e }]);
         saveToDb("system", "Error running command: " + e);
       }
       return;
    }

    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    saveToDb("user", userMsg);
    try {
      await invoke("send_message", { message: userMsg });
    } catch (e) {
      console.error(e);
      setMessages((prev) => [...prev, { role: "assistant", content: "Error sending message: " + e }]);
      saveToDb("assistant", "Error sending message: " + e);
    }
  }

  function selectFile(path: string) {
    const atIndex = input.lastIndexOf("@");
    const newInput = input.slice(0, atIndex) + path + " ";
    setInput(newInput);
    setShowFileSuggestions(false);
  }

  async function injectFile(path: string) {
     try {
        const content = await invoke<string>("read_file", { path });
        const injectMsg = `Content of file ${path}:\n\n${content}`;
        setMessages((prev) => [...prev, { role: "user", content: `[Injected file: ${path}]` }]);
        await invoke("send_message", { message: injectMsg });
     } catch (e) {
        console.error(e);
        alert("Failed to read file: " + e);
     }
  }

  async function clearHistory() {
     if (db) {
        await db.execute("DELETE FROM messages");
        setMessages([]);
     }
  }

  const filteredFiles = fileList
    .filter(f => f.toLowerCase().includes(fileFilter.toLowerCase()))
    .slice(0, 10);

  const tokenEstimate = Math.ceil(input.length / 4);

  return (
    <div className="codex-app">
      <aside className="sidebar">
        <div className="sidebar-header">Files</div>
        <div className="file-tree">
          {fileList.map((f, i) => (
            <div key={i} className="file-item" onClick={() => injectFile(f)}>
              {f}
            </div>
          ))}
        </div>
      </aside>

      <div className="main-content">
        <header>
          <div className="title-area">
            <h1>GeminiX</h1>
            <select 
              disabled={isSpawned} 
              value={selectedModel || ""} 
              onChange={(e) => setSelectedModel(e.target.value || null)}
            >
              <option value="">Default Model</option>
              <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
              <option value="gemini-2.0-pro-exp">Gemini 2.0 Pro</option>
            </select>
          </div>
          <div className="header-controls">
            {!isSpawned ? (
              <>
                <button onClick={() => startGemini(false)} disabled={isSpawning}>
                  {isSpawning ? "..." : "New Session"}
                </button>
                <button className="resume-btn" onClick={() => startGemini(true)} disabled={isSpawning}>
                  {isSpawning ? "..." : "Resume Latest"}
                </button>
              </>
            ) : (
              <div className="status-badge active">● Connected</div>
            )}
          </div>
        </header>
        
        <main className="chat-window" ref={chatWindowRef}>
          {messages.map((m, i) => (
            <div key={i} className={`message-row ${m.role}`}>
              <span className="role-tag">{m.role === 'user' ? '>' : m.role === 'system' ? '#' : 'AI'}</span>
              <pre className="message-content">{m.content}</pre>
            </div>
          ))}
        </main>

        {isSpawned && (
          <div className="input-container">
            {showFileSuggestions && (
              <div className="file-suggestions">
                {filteredFiles.map((f, i) => (
                  <div key={i} className="suggestion" onClick={() => selectFile(f)}>
                    {f}
                  </div>
                ))}
              </div>
            )}
            <form className="input-area" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
              <div className="input-info">
                <span className="token-count">{tokenEstimate} tokens</span>
                <button type="button" className="clear-btn" onClick={clearHistory}>Clear History</button>
              </div>
              <input
                autoFocus
                value={input}
                onChange={(e) => setInput(e.currentTarget.value)}
                placeholder="Type a message (use @ for file, ! for shell)..."
              />
              <button type="submit">Send</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
