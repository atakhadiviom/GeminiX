import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChatMessage, SessionRecord } from "../types";

const STORAGE_KEY = "geminix:sessions";
const LAST_SESSION_KEY = "geminix:last-session";

const createEmptySession = (): SessionRecord => {
  const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    label: "New session",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
};

const readSessions = (): SessionRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as SessionRecord[];
    return parsed.filter((session) => Array.isArray(session.messages));
  } catch {
    return [];
  }
};

export const useSession = () => {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");

  useEffect(() => {
    const storedSessions = readSessions();
    if (storedSessions.length === 0) {
      const first = createEmptySession();
      setSessions([first]);
      setCurrentSessionId(first.id);
      return;
    }

    const lastSessionId = localStorage.getItem(LAST_SESSION_KEY);
    setSessions(storedSessions);
    setCurrentSessionId(
      storedSessions.some((session) => session.id === lastSessionId)
        ? (lastSessionId as string)
        : storedSessions[0].id,
    );
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem(LAST_SESSION_KEY, currentSessionId);
    }
  }, [currentSessionId]);

  const currentSession = useMemo(
    () => sessions.find((session) => session.id === currentSessionId) ?? null,
    [currentSessionId, sessions],
  );

  const createSession = useCallback(() => {
    const next = createEmptySession();
    setSessions((previous) => [next, ...previous]);
    setCurrentSessionId(next.id);
    return next.id;
  }, []);

  const loadSession = useCallback((id: string) => {
    setCurrentSessionId(id);
  }, []);

  const clearSession = useCallback(() => {
    if (!currentSessionId) {
      return;
    }
    setSessions((previous) =>
      previous.map((session) =>
        session.id === currentSessionId
          ? {
              ...session,
              label: "New session",
              updatedAt: Date.now(),
              messages: [],
            }
          : session,
      ),
    );
  }, [currentSessionId]);

  const setMessages = useCallback(
    (updater: ChatMessage[] | ((messages: ChatMessage[]) => ChatMessage[])) => {
      if (!currentSessionId) {
        return;
      }

      setSessions((previous) =>
        previous.map((session) => {
          if (session.id !== currentSessionId) {
            return session;
          }

          const nextMessages =
            typeof updater === "function" ? updater(session.messages) : updater;
          const firstUserMessage = nextMessages.find((message) => message.role === "user");

          return {
            ...session,
            label: firstUserMessage
              ? firstUserMessage.content.slice(0, 36) || "Session"
              : "New session",
            updatedAt: Date.now(),
            messages: nextMessages,
          };
        }),
      );
    },
    [currentSessionId],
  );

  return {
    sessions,
    currentSessionId,
    currentSession,
    messages: currentSession?.messages ?? [],
    createSession,
    loadSession,
    clearSession,
    setMessages,
  };
};
