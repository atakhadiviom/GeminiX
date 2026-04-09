import React from "react";
import { AppSettings, ChatSession } from "../types";

interface SidebarProps {
  workspaceName: string;
  sessions: ChatSession[];
  currentSessionId: string;
  loadSession: (id: string) => void;
  createSession: () => void;
  onOpenSettings: () => void;
}

const formatTime = (ts: number) => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

export const Sidebar = ({
  workspaceName,
  sessions,
  currentSessionId,
  loadSession,
  createSession,
  onOpenSettings,
}: SidebarProps) => {
  return (
    <aside className="flex h-full w-[260px] flex-col border-r border-[#27272a] bg-[#09090b] text-[#fafafa] text-[13px] font-sans">
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col py-3">
        <div className="px-3 pb-4 space-y-1">
          <button onClick={createSession} className="flex items-center gap-3 w-full px-2 py-2 hover:bg-[#27272a]/50 rounded-md transition-colors text-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            <span>New chat</span>
            <span className="ml-auto text-xs text-[#a1a1aa]">⌘L</span>
          </button>
          
          <button className="flex items-center gap-3 w-full px-2 py-2 hover:bg-[#27272a]/50 rounded-md transition-colors text-left text-[#a1a1aa]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span>Search</span>
          </button>
          
          <button className="flex items-center gap-3 w-full px-2 py-2 hover:bg-[#27272a]/50 rounded-md transition-colors text-left text-[#a1a1aa]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            <span>Plugins</span>
          </button>

          <button className="flex items-center gap-3 w-full px-2 py-2 hover:bg-[#27272a]/50 rounded-md transition-colors text-left text-[#a1a1aa]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>Automations</span>
            <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-full bg-[#27272a] text-[10px]">1</span>
          </button>
        </div>

        <div className="px-3">
          <div className="flex items-center justify-between text-xs text-[#a1a1aa] font-medium px-2 py-2">
            <span>Threads</span>
            <div className="flex gap-2">
               {/* Mock Filter / collapse icons */}
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cursor-pointer hover:text-white"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cursor-pointer hover:text-white"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line></svg>
            </div>
          </div>

          <div className="mt-1">
            <div className="flex items-center gap-2 px-2 py-2 text-[#fafafa] font-medium opacity-80">
              📁 {workspaceName}
            </div>
            
            <div className="pl-6 flex flex-col space-y-[2px]">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`flex items-center justify-between px-2 py-1.5 rounded text-left transition-colors truncate ${
                    session.id === currentSessionId ? "bg-[#27272a]/60 text-white" : "text-[#a1a1aa] hover:bg-[#27272a]/30"
                  }`}
                >
                  <span className="truncate pr-3">{session.label || "New Chat"}</span>
                  <span className="text-[10px] text-[#52525b] shrink-0">{formatTime(session.updatedAt)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-[#27272a]/50">
        <button onClick={onOpenSettings} className="flex items-center gap-3 w-full px-2 py-2 hover:bg-[#27272a]/50 rounded-md transition-colors text-left font-medium">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          <span className="text-sm">Settings</span>
        </button>
      </div>
    </aside>
  );
};
