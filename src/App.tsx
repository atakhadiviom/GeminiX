import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { ChatThread } from "./components/ChatThread";
import { Sidebar } from "./components/Sidebar";
import { MessageInput } from "./components/MessageInput";
import { SettingsPanel } from "./components/SettingsPanel";
import { useSession } from "./hooks/useSession";
import type { AppSettings, ChatMessage, FileEntry } from "./types";

const SETTINGS_KEY = "geminix:settings";

const defaultSettings: AppSettings = {
  model: "auto",
  approvalMode: "Ask",
  apiKey: "",
  theme: "dark",
};

const createMessage = (role: ChatMessage["role"], content: string): ChatMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  createdAt: Date.now(),
});

const joinPath = (base: string, segment: string) => {
  const separator = base.includes("\\") && !base.includes("/") ? "\\" : "/";
  return `${base.replace(/[\\/]+$/, "")}${separator}${segment}`;
};

const flattenFiles = (entries: FileEntry[]): FileEntry[] =>
  entries.flatMap((entry) => [entry, ...flattenFiles(entry.children ?? [])]);

const extractChunkText = (payload: string) => {
  let raw = payload.trim();
  if (!raw) return "";

  const jsonStart = raw.indexOf("{");
  if (jsonStart > 0) {
    raw = raw.slice(jsonStart);
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    
    // Ignore non-message events
    if (parsed.type && parsed.type !== "message") {
      return "";
    }

    // Ignore echoed user messages
    if (parsed.role === "user") {
      return "";
    }

    const candidates: unknown[] = [
      parsed.text,
      parsed.content,
      parsed.delta,
      parsed.message,
      parsed.response,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate) return candidate;
      if (candidate && typeof candidate === "object") {
        const nested = candidate as Record<string, unknown>;
        if (typeof nested.text === "string" && nested.text) return nested.text;
        if (typeof nested.content === "string" && nested.content) return nested.content;
      }
    }
    
    return "";
  } catch {
    // If it's genuinely not JSON, maybe return it as raw text
    return payload;
  }
};

const buildConversationPrompt = (
  messages: ChatMessage[],
  incomingMessage: string,
  agentInstructions: string | null,
) => {
  const sections: string[] = [];

  if (agentInstructions) {
    sections.push(`Workspace instructions:\n${agentInstructions}`);
  }

  if (messages.length > 0) {
    sections.push(
      "Conversation so far:\n" +
        messages
          .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
          .join("\n\n"),
    );
  }

  sections.push(`USER:\n${incomingMessage}`);
  return sections.join("\n\n");
};

function App() {
  const {
    sessions,
    currentSessionId,
    currentSession,
    messages,
    createSession,
    loadSession,
    clearSession,
    setMessages,
  } = useSession();
  const [workspacePath, setWorkspacePath] = useState("");
  const [workspaceEntries, setWorkspaceEntries] = useState<FileEntry[]>([]);
  const [agentInstructions, setAgentInstructions] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? { ...defaultSettings, ...(JSON.parse(raw) as Partial<AppSettings>) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [settingsCollapsed, setSettingsCollapsed] = useState(true);
  const promptedForWorkspace = useRef(false);

  const flattenedFiles = useMemo(
    () => flattenFiles(workspaceEntries).filter((entry) => !entry.isDir),
    [workspaceEntries],
  );

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    void invoke("set_runtime_config", {
      model: settings.model,
      api_key: settings.apiKey,
      approval_mode: settings.approvalMode,
    });
  }, [settings.apiKey, settings.model]);

  useEffect(() => {
    const unlistenPromises = [
      listen<string>("gemini-chunk", (event) => {
        const text = extractChunkText(event.payload);
        if (!text) return;
        setMessages((current) => {
          const next = [...current];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, content: `${last.content}${text}` };
            return next;
          }
          return [...next, createMessage("assistant", text)];
        });
      }),
      listen("gemini-done", () => setIsStreaming(false)),
      listen<string>("gemini-error", (event) => {
        setIsStreaming(false);
        setMessages((current) => [
          ...current,
          createMessage("system", `Gemini error:\n${event.payload}`),
        ]);
      }),
    ];

    return () => {
      for (const promise of unlistenPromises) {
        void promise.then((unlisten) => unlisten());
      }
    };
  }, [setMessages]);

  const appendSystemMessage = (content: string) => {
    setMessages((current) => [...current, createMessage("system", content)]);
  };

  const loadWorkspace = async (path: string) => {
    const entries = await invoke<FileEntry[]>("list_directory", { path });
    setWorkspacePath(path);
    setWorkspaceEntries(entries);

    const candidates = ["AGENTS.md", "GEMINI.md"] as const;
    let loadedInstructions: string | null = null;

    for (const candidate of candidates) {
      try {
        const content = await invoke<string>("read_file", { path: joinPath(path, candidate) });
        if (content.trim()) {
          loadedInstructions = content;
          break;
        }
      } catch {
        continue;
      }
    }
    setAgentInstructions(loadedInstructions);
  };

  useEffect(() => {
    if (promptedForWorkspace.current) return;
    promptedForWorkspace.current = true;
    void (async () => {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string") {
        await loadWorkspace(selected);
      }
    })();
  }, []);

  const handleAbort = async () => {
    await invoke("kill_gemini");
    setIsStreaming(false);
  };

  const handleShellCommand = async (cmd: string) => {
    if (!cmd.trim()) return "";

    if (settings.approvalMode === "Ask" && !window.confirm(`Run shell command?\n\n${cmd}`)) {
      const skipped = `Shell command skipped:\n${cmd}`;
      appendSystemMessage(skipped);
      return skipped;
    }

    try {
      const result = await invoke<string>("run_shell", { cmd });
      const content = `$ ${cmd}\n${result}`;
      appendSystemMessage(content);
      return content;
    } catch (error) {
      const content = `Shell command failed:\n${String(error)}`;
      appendSystemMessage(content);
      return content;
    }
  };

  const handleSlashCommand = async (input: string) => {
    const [command, ...rest] = input.split(" ");
    switch (command) {
      case "/clear":
        clearSession();
        return true;
      case "/model":
        if (rest[0]) {
          setSettings((current) => ({ ...current, model: rest[0] }));
          appendSystemMessage(`Model switched to ${rest[0]}`);
          return true;
        }
        appendSystemMessage("Usage: /model <name>");
        return true;
      case "/shell":
        await handleShellCommand(rest.join(" "));
        return true;
      case "/help":
        appendSystemMessage(["/clear", "/model <name>", "/shell <cmd>", "/help"].join("\n"));
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async (rawInput: string) => {
    if (!workspacePath) {
      appendSystemMessage("Open a workspace first.");
      return;
    }

    if (rawInput.startsWith("/")) {
      const handled = await handleSlashCommand(rawInput);
      if (handled) return;
    }

    const lines = rawInput.split("\n");
    const shellLines = lines.filter((line) => line.trim().startsWith("!"));
    const promptLines = lines.filter((line) => !line.trim().startsWith("!"));
    const shellOutputs: ChatMessage[] = [];

    for (const line of shellLines) {
      const command = line.trim().slice(1).trim();
      if (command) {
        const output = await handleShellCommand(command);
        if (output) shellOutputs.push(createMessage("system", output));
      }
    }

    const messageText = promptLines.join("\n").trim();
    if (!messageText) return;

    const mentionedPaths = Array.from(messageText.matchAll(/@([^\s@]+)/g)).map((match) => match[1]);
    const mentionedFiles = flattenedFiles.filter((file) => mentionedPaths.includes(file.relativePath));
    const selectedContextPaths = new Set(mentionedFiles.map((file) => file.path));

    const nextUserMessage = createMessage("user", messageText);
    const nextAssistantMessage = createMessage("assistant", "");

    setMessages((current) => [...current, nextUserMessage, nextAssistantMessage]);
    setIsStreaming(true);

    try {
      await invoke("set_runtime_config", {
        model: settings.model,
        api_key: settings.apiKey,
        approval_mode: settings.approvalMode,
      });
      await invoke("spawn_gemini", {
        prompt: buildConversationPrompt([...messages, ...shellOutputs], messageText, agentInstructions),
        files: Array.from(selectedContextPaths),
      });
    } catch (error) {
      setIsStreaming(false);
      setMessages((current) => current.filter((message) => message.id !== nextAssistantMessage.id));
      const message = String(error);
      const installHelp = message.includes("Gemini CLI was not found")
        ? `${message}\n\nInstall instructions:\n1. Install the Gemini CLI.\n2. Make sure \`gemini --help\` works in your terminal.\n3. Restart GeminiX.`
        : message;
      appendSystemMessage(installHelp);
    }
  };

  const workspaceName = workspacePath
    ? workspacePath.split(/[\\/]/).filter(Boolean).pop() ?? workspacePath
    : "No workspace";

  return (
    <div className="flex h-screen min-h-[700px] min-w-[1000px] bg-[#09090b] font-sans text-[#fafafa] overflow-hidden relative">
      <Sidebar
        workspaceName={workspaceName}
        sessions={sessions}
        currentSessionId={currentSessionId}
        loadSession={loadSession}
        createSession={createSession}
        onOpenSettings={() => setSettingsCollapsed(false)}
      />

      <main className="flex-1 flex flex-col relative min-w-0 bg-[#000000]">
        {!workspacePath ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">GeminiX</h1>
              <p className="text-[#a1a1aa] mb-6">Open a workspace to get started</p>
              <button
                onClick={async () => {
                  const selected = await open({ directory: true, multiple: false });
                  if (typeof selected === "string") await loadWorkspace(selected);
                }}
                className="bg-white text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Choose workspace
              </button>
            </div>
          </div>
        ) : (
          <>
            <ChatThread
              messages={messages}
              isStreaming={isStreaming}
              workspaceName={workspaceName}
              chatTitle={currentSession?.label || "New Chat"}
            />
            
            <div className="shrink-0">
              <MessageInput
                allFiles={flattenedFiles.map((file) => ({
                  path: file.path,
                  relativePath: file.relativePath,
                }))}
                isStreaming={isStreaming}
                onAbort={() => void handleAbort()}
                onSubmit={(message) => void handleSubmit(message)}
                model={settings.model}
              />
            </div>
          </>
        )}
      </main>

      {!settingsCollapsed && (
        <div className="absolute inset-y-0 right-0 z-50 shadow-2xl flex border-l border-[#27272a]">
          <SettingsPanel
            collapsed={settingsCollapsed}
            onChange={setSettings}
            onClearSession={clearSession}
            onToggleCollapse={() => setSettingsCollapsed(true)}
            settings={settings}
          />
        </div>
      )}
    </div>
  );
}

export default App;
