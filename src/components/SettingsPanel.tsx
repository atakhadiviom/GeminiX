import type { AppSettings } from "../types";

interface SettingsPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
  onClearSession: () => void;
}

const MODELS = ["auto", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash-exp"];

export const SettingsPanel = ({
  collapsed,
  onToggleCollapse,
  settings,
  onChange,
  onClearSession,
}: SettingsPanelProps) => {
  if (collapsed) {
    return null;
  }

  return (
    <aside className="relative flex h-full w-[320px] flex-col bg-[#18181b] text-[#fafafa] font-sans">
      <div className="flex items-center justify-between border-b border-[#27272a] px-4 py-3">
        <div>
          <div className="font-medium text-sm text-[#fafafa]">Settings</div>
          <div className="text-[11px] text-[#a1a1aa]">Local workspace configuration</div>
        </div>
        <button
          className="p-1 text-[#a1a1aa] hover:text-[#fafafa] transition-colors hover:bg-[#27272a] rounded"
          onClick={onToggleCollapse}
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 text-sm">
        <label className="block space-y-2">
          <span className="text-[#a1a1aa] text-xs font-semibold uppercase tracking-wider">Model</span>
          <select
            className="w-full border border-[#27272a] bg-[#09090b] px-3 py-2 rounded-md outline-none focus:border-[#52525b]"
            onChange={(event) => onChange({ ...settings, model: event.target.value })}
            value={settings.model}
          >
            {MODELS.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          <div className="text-[#a1a1aa] text-xs font-semibold uppercase tracking-wider">Approval mode</div>
          <div className="grid grid-cols-2 gap-2 bg-[#09090b] p-1 rounded-md border border-[#27272a]">
            {(["Auto", "Ask"] as const).map((mode) => (
              <button
                className={`py-1.5 text-center text-sm rounded ${
                  settings.approvalMode === mode
                    ? "bg-[#27272a] text-[#fafafa] shadow-sm"
                    : "text-[#a1a1aa] hover:text-[#fafafa]"
                }`}
                key={mode}
                onClick={() => onChange({ ...settings, approvalMode: mode })}
                type="button"
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <label className="block space-y-2">
          <span className="text-[#a1a1aa] text-xs font-semibold uppercase tracking-wider">GOOGLE_API_KEY</span>
          <input
            className="w-full border border-[#27272a] bg-[#09090b] px-3 py-2 rounded-md outline-none focus:border-[#52525b] text-[#fafafa]"
            onChange={(event) => onChange({ ...settings, apiKey: event.target.value })}
            placeholder="AIza..."
            type="password"
            value={settings.apiKey}
          />
        </label>

        <div className="space-y-2">
           <span className="text-[#a1a1aa] text-xs font-semibold uppercase tracking-wider mt-4 block">Theme</span>
           <button
             className="w-full border border-blue-600 px-3 py-2 text-center text-[#fafafa] rounded-md bg-blue-600/10 text-sm"
             onClick={() => onChange({ ...settings, theme: "dark" })}
             type="button"
           >
             Dark / IDE
           </button>
        </div>

        <div className="pt-4 mt-6 border-t border-[#27272a]">
          <button
            className="w-full border border-[#ef4444]/30 px-3 py-2 text-center text-[#ef4444] rounded-md hover:bg-[#ef4444]/10 transition-colors"
            onClick={onClearSession}
            type="button"
          >
            Clear session history
          </button>
        </div>
      </div>
    </aside>
  );
};
