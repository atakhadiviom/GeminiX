import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { Message } from '../types';

interface ChatThreadProps {
  messages: Message[];
  isStreaming: boolean;
  workspaceName?: string;
  chatTitle?: string;
}

function CodeBlock({ node, inline, className, children, ...props }: any) {
  const match = /language-(\w+)/.exec(className || '');
  const [copied, setCopied] = useState(false);
  const codeText = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && match) {
    return (
      <div className="relative group my-4 rounded-lg overflow-hidden border border-[#27272a] bg-[#09090b]">
        <div className="flex items-center justify-between px-4 py-2 bg-[#18181b] border-b border-[#27272a]">
          <span className="text-xs font-mono text-[#a1a1aa] lowercase">{match[1]}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-[#a1a1aa] hover:text-[#fafafa] transition-colors"
          >
            {copied ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy</>
            )}
          </button>
        </div>
        <pre className={`!m-0 !p-4 !bg-transparent !border-none text-[13px] text-[#fafafa] ${className}`} {...props}>
          <code className={className}>{children}</code>
        </pre>
      </div>
    );
  }

  return (
    <code className={`px-1.5 py-0.5 rounded text-[13px] bg-[#27272a] text-[#fafafa] ${className}`} {...props}>
      {children}
    </code>
  );
}

export function ChatThread({ messages, isStreaming, workspaceName = "Workspace", chatTitle = "New Chat" }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col px-4 pt-6 pb-2">
      <div className="max-w-3xl mx-auto w-full mb-8">
        <h1 className="text-lg font-bold text-[#fafafa] flex items-center gap-2">
          {chatTitle} 
          <span className="text-sm font-normal text-[#a1a1aa] bg-[#27272a]/50 px-2 rounded-md py-0.5 ml-2 truncate max-w-[150px]">{workspaceName}</span>
          <span className="text-sm font-normal text-[#a1a1aa] ml-2">...</span>
          <div className="ml-auto flex items-center gap-3">
             <button className="text-[#a1a1aa] hover:text-white transition-colors"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button>
             <button className="text-[#a1a1aa] hover:text-white transition-colors"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg></button>
             <div className="flex items-center gap-1.5 text-xs text-[#a1a1aa] border border-[#27272a] rounded-full px-2 py-1 ml-2 cursor-pointer hover:bg-[#27272a]/50">
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M13 6h3a2 2 0 0 1 2 2v7"></path><line x1="6" y1="9" x2="6" y2="21"></line></svg>
               Commit
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
             </div>
          </div>
        </h1>
      </div>

      <div className="max-w-3xl mx-auto w-full flex flex-col gap-6">
        {messages.length === 0 ? (
          <div className="text-center text-[#a1a1aa] py-10 text-sm">
            What are we building today?
          </div>
        ) : null}

        {messages.map((message) => {
          if (message.role === 'system') {
            return (
              <div key={message.id} className="flex justify-start text-xs text-[#a1a1aa] font-mono">
                <div className="px-3 py-1.5 rounded border border-[#27272a] bg-[#18181b]/50 italic">
                  {message.content}
                </div>
              </div>
            );
          }

          const isUser = message.role === 'user';

          if (isUser) {
            return (
              <div key={message.id} className="flex justify-end w-full">
                <div className="bg-[#27272a] text-[#fafafa] px-4 py-2 rounded-2xl text-[14px] max-w-[80%] whitespace-pre-wrap">
                  {message.content}
                </div>
              </div>
            );
          }

          return (
            <div key={message.id} className="w-full text-[14px] text-[#fafafa]">
              <div className="prose prose-invert max-w-none prose-terminal relative pl-8">
                {/* Assistant Icon Placeholder */}
                <div className="absolute left-0 top-0.5 mt-[2px] w-5 h-5 rounded-md bg-white text-black flex items-center justify-center font-bold pb-0.5 shadow-sm">
                   ✨
                </div>

                {message.content === "" && isStreaming ? (
                   <span className="text-[#a1a1aa]">Thinking<span className="animate-pulse">...</span></span>
                ) : (
                  <>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      components={{ code: CodeBlock }}
                    >
                      {message.content}
                    </ReactMarkdown>
                    {isStreaming && message === messages[messages.length - 1] && (
                      <span className="inline-block w-2 h-4 bg-[#fafafa] ml-1 animate-pulse align-middle" />
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} className="h-4 flex-shrink-0" />
      </div>
    </div>
  );
}
