import Fuse from "fuse.js";
import { useEffect, useMemo, useRef, useState } from "react";

interface MentionableFile {
  path: string;
  relativePath: string;
}

interface MessageInputProps {
  allFiles: MentionableFile[];
  isStreaming: boolean;
  onAbort: () => void;
  onSubmit: (message: string) => void;
  model: string;
}

export const MessageInput = ({
  allFiles,
  isStreaming,
  onAbort,
  onSubmit,
  model,
}: MessageInputProps) => {
  const [value, setValue] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const fuse = useMemo(
    () =>
      new Fuse(allFiles, {
        threshold: 0.35,
        keys: ["relativePath"],
      }),
    [allFiles],
  );

  const mentionResults = useMemo(() => {
    if (mentionQuery === null) {
      return [];
    }
    return mentionQuery.trim()
      ? fuse.search(mentionQuery).map((result) => result.item).slice(0, 8)
      : allFiles.slice(0, 8);
  }, [allFiles, fuse, mentionQuery]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 250)}px`;
  }, [value]);

  const updateMentionState = (nextValue: string, caretPosition: number) => {
    const beforeCursor = nextValue.slice(0, caretPosition);
    const match = beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
    setMentionQuery(match ? match[1] : null);
  };

  const insertMention = (relativePath: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const beforeCursor = value.slice(0, selectionStart);
    const afterCursor = value.slice(selectionEnd);
    const replaced = beforeCursor.replace(/@([^\s@]*)$/, `@${relativePath}`);
    const nextValue = `${replaced} ${afterCursor}`;
    setValue(nextValue);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const nextCursor = replaced.length + 1;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    onSubmit(trimmed);
    setValue("");
    setMentionQuery(null);
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      {mentionQuery !== null && mentionResults.length > 0 ? (
        <div className="mb-2 max-h-56 overflow-y-auto border border-[#27272a] bg-[#18181b] rounded-lg shadow-xl shadow-black/50">
          {mentionResults.map((file) => (
            <button
              className="block flex items-center w-full border-b border-[#27272a]/50 px-3 py-2.5 text-left text-[13px] text-[#fafafa] transition-colors hover:bg-[#27272a]"
              key={file.path}
              onClick={() => insertMention(file.relativePath)}
              type="button"
            >
              <svg className="w-4 h-4 mr-2 text-[#a1a1aa]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              {file.relativePath}
            </button>
          ))}
        </div>
      ) : null}

      <div className="w-full bg-[#18181b] border border-[#27272a] rounded-xl shadow-xl flex flex-col transition-all focus-within:border-[#3f3f46]">
        <textarea
          className="w-full bg-transparent min-h-[50px] max-h-[300px] py-3.5 px-4 text-[14px] leading-relaxed resize-none outline-none text-[#fafafa] placeholder-[#a1a1aa] custom-scrollbar"
          onChange={(event) => {
            setValue(event.target.value);
            updateMentionState(event.target.value, event.target.selectionStart);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          onSelect={(event) => {
            const target = event.target as HTMLTextAreaElement;
            updateMentionState(target.value, target.selectionStart);
          }}
          placeholder="Ask for follow-up changes"
          ref={textareaRef}
          value={value}
          rows={1}
        />

        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex items-center gap-1.5">
            <button className="flex items-center justify-center p-1.5 text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#fafafa] rounded-md transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <div className="flex items-center gap-1 px-2 py-1 text-[12px] font-medium text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#fafafa] rounded-md cursor-pointer transition-colors bg-[#09090b]">
              <span>{model || 'GPT-5.4'}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              <span>Medium</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button className="p-1.5 text-[#a1a1aa] hover:text-[#fafafa] transition-colors rounded-md hover:bg-[#27272a]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
            </button>
            {isStreaming ? (
              <button
                className="p-1.5 rounded-full bg-white text-black flex items-center justify-center transition-all shadow-sm w-[26px] h-[26px]"
                onClick={onAbort}
                type="button"
                title="Stop"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
              </button>
            ) : (
              <button
                className={`p-1.5 rounded-full flex items-center justify-center transition-all shadow-sm w-[26px] h-[26px] ${value.trim() ? "bg-white text-black" : "bg-[#27272a] text-[#a1a1aa]"}`}
                onClick={submit}
                disabled={!value.trim()}
                type="button"
                title="Send"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"></line>
                  <polyline points="5 12 12 5 19 12"></polyline>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4 mt-2 px-1 text-[11px] text-[#a1a1aa]">
        <button className="flex items-center gap-1.5 hover:text-[#fafafa] transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
          Local
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <button className="flex items-center gap-1.5 hover:text-[#fafafa] transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          Default permissions
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <div className="ml-auto flex items-center gap-1.5 hover:text-[#fafafa] cursor-pointer transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="6" y1="9" x2="6" y2="15"></line></svg>
          master
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>
    </div>
  );
};
