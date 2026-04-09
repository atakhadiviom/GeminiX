import { useMemo, useState } from "react";
import type { FileEntry, SelectedFileMeta } from "../types";

interface FileExplorerProps {
  entries: FileEntry[];
  selectedFiles: Record<string, SelectedFileMeta>;
  onToggleFile: (entry: FileEntry, checked: boolean) => void;
  onRefresh: () => void;
  agentsBadgeLabel: string | null;
}

const iconForFile = (name: string, isDir: boolean) => {
  if (isDir) {
    return "DIR";
  }
  if (/\.(ts|tsx|js|jsx)$/i.test(name)) {
    return "TS";
  }
  if (/\.py$/i.test(name)) {
    return "PY";
  }
  if (/\.rs$/i.test(name)) {
    return "RS";
  }
  if (/\.(md|txt|json|toml|yaml|yml)$/i.test(name)) {
    return "TXT";
  }
  return "FILE";
};

const TreeNode = ({
  entry,
  selectedFiles,
  onToggleFile,
  depth = 0,
}: {
  entry: FileEntry;
  selectedFiles: Record<string, SelectedFileMeta>;
  onToggleFile: (entry: FileEntry, checked: boolean) => void;
  depth?: number;
}) => {
  const [open, setOpen] = useState(depth < 2);
  const checked = Boolean(selectedFiles[entry.path]);

  if (entry.isDir) {
    return (
      <div>
        <button
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-terminal-text transition-colors duration-150 ease-in hover:bg-terminal-border/50"
          onClick={() => setOpen((current) => !current)}
          style={{ paddingLeft: `${depth * 14 + 12}px` }}
          type="button"
        >
          <span className="w-3 text-terminal-muted">{open ? "v" : ">"}</span>
          <span className="w-10 text-[11px] uppercase tracking-[0.18em] text-terminal-muted">
            {iconForFile(entry.name, true)}
          </span>
          <span className="truncate">{entry.name}</span>
        </button>
        {open ? (
          <div>
            {entry.children.map((child) => (
              <TreeNode
                depth={depth + 1}
                entry={child}
                key={child.path}
                onToggleFile={onToggleFile}
                selectedFiles={selectedFiles}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <label
      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-terminal-text transition-colors duration-150 ease-in hover:bg-terminal-border/50"
      style={{ paddingLeft: `${depth * 14 + 26}px` }}
    >
      <input
        checked={checked}
        className="h-3.5 w-3.5 rounded-none border-terminal-border bg-black text-terminal-accent focus:ring-0"
        onChange={(event) => onToggleFile(entry, event.target.checked)}
        type="checkbox"
      />
      <span className="w-10 text-[11px] uppercase tracking-[0.18em] text-terminal-muted">
        {iconForFile(entry.name, false)}
      </span>
      <span className="truncate">{entry.name}</span>
    </label>
  );
};

export const FileExplorer = ({
  entries,
  selectedFiles,
  onToggleFile,
  onRefresh,
  agentsBadgeLabel,
}: FileExplorerProps) => {
  const totalChars = useMemo(
    () =>
      Object.values(selectedFiles).reduce((sum, file) => {
        return sum + file.charCount;
      }, 0),
    [selectedFiles],
  );

  return (
    <aside className="flex h-full w-[240px] flex-col border-r border-terminal-border bg-terminal-surface">
      <div className="border-b border-terminal-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.24em] text-terminal-muted">
              Workspace
            </div>
            {agentsBadgeLabel ? (
              <div className="mt-2 inline-flex items-center border border-terminal-border px-2 py-1 text-[11px] text-terminal-accent">
                {agentsBadgeLabel}
              </div>
            ) : null}
          </div>
          <button
            className="border border-terminal-border px-2 py-1 text-xs text-terminal-muted transition-colors duration-150 ease-in hover:text-terminal-text"
            onClick={onRefresh}
            type="button"
          >
            Refresh
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {entries.map((entry) => (
          <TreeNode
            entry={entry}
            key={entry.path}
            onToggleFile={onToggleFile}
            selectedFiles={selectedFiles}
          />
        ))}
      </div>
      <div className="border-t border-terminal-border px-4 py-3 text-xs text-terminal-muted">
        ~{Math.round(totalChars / 4)} tokens
      </div>
    </aside>
  );
};
