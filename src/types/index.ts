export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
}

export interface FileEntry {
  name: string;
  path: string;
  relativePath: string;
  isDir: boolean;
  children: FileEntry[];
}

export interface SelectedFileMeta {
  path: string;
  relativePath: string;
  charCount: number;
}

export interface SessionRecord {
  id: string;
  label: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface AppSettings {
  model: string;
  approvalMode: "Auto" | "Ask";
  apiKey: string;
  theme: "dark";
}
