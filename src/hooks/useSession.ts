import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { RecordingMode, Session, Settings } from "../lib/types";
import { listSessions, saveSession, deleteSession } from "../lib/sessions";
import { checkOllama, summarize, generateTitle } from "../lib/ollama";

const DEFAULT_SETTINGS: Settings = {
  whisperPath: "/opt/homebrew/bin/whisper-cli",
  modelPath: "/Users/home/.studyflow/models/ggml-large-v3-turbo.bin",
  ollamaModel: "llama3.2",
  language: "tr",
  theme: "dark",
};

const SETTINGS_KEY = "studyflow.settings";

interface UseSessionReturn {
  sessions: Session[];
  activeSession: Session | null;
  settings: Settings;
  isLoading: boolean;
  error: string | null;
  loadSessions: () => Promise<void>;
  startProcessing: (audioPath: string, duration: number, mode: RecordingMode) => Promise<void>;
  selectSession: (session: Session) => void;
  removeSession: (id: string) => Promise<void>;
  updateSettings: (s: Partial<Settings>) => void;
  updateActiveSession: (patch: Partial<Session>) => Promise<void>;
  clearActiveSession: () => void;
}

function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    const settings = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;

    return {
      ...settings,
      whisperPath:
        settings.whisperPath === "/usr/local/bin/whisper-cpp"
          ? DEFAULT_SETTINGS.whisperPath
          : settings.whisperPath,
      modelPath:
        settings.modelPath === "~/.studyflow/models/ggml-large-v3-turbo.bin"
          ? DEFAULT_SETTINGS.modelPath
          : settings.modelPath,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function normalizeSession(session: Session): Session {
  return {
    ...session,
    mode: session.mode || "lecture",
    keyPoints: session.keyPoints ?? [],
    actionItems: session.actionItems ?? [],
  };
}

export function useSession(): UseSessionReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const all = await listSessions();
      setSessions(
        all.map(normalizeSession).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Oturumlar yüklenemedi");
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const startProcessing = useCallback(
    async (audioPath: string, duration: number, mode: RecordingMode) => {
      setIsLoading(true);
      setError(null);

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const draft: Session = {
        id,
        title: "İşleniyor...",
        mode,
        createdAt: now,
        duration,
        audioPath,
        transcript: "",
        summary: "",
        keyPoints: [],
        actionItems: [],
        status: "transcribing",
      };

      setActiveSession(draft);

      try {
        const transcript = await invoke<string>("transcribe", {
          audioPath,
          language: settings.language,
          whisperPath: settings.whisperPath,
          modelPath: settings.modelPath,
        });

        const transcribed: Session = { ...draft, transcript, status: "summarizing" };
        setActiveSession(transcribed);

        const ollamaReady = await checkOllama();
        if (!ollamaReady) {
          throw new Error("Ollama başlatılmamış. Terminal'de ollama serve çalıştır.");
        }

        const [summaryResult, title] = await Promise.all([
          summarize(transcript, mode, settings.ollamaModel),
          generateTitle(transcript, settings.ollamaModel),
        ]);

        const done: Session = {
          ...transcribed,
          title,
          summary: summaryResult.summary,
          keyPoints: summaryResult.keyPoints,
          actionItems: summaryResult.actionItems,
          status: "done",
        };
        setActiveSession(done);
        await saveSession(done);
        setSessions((prev) => [done, ...prev]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "İşlem başarısız";
        setError(msg);
        setActiveSession((prev) => (prev ? { ...prev, status: "error" } : null));
      } finally {
        setIsLoading(false);
      }
    },
    [settings]
  );

  const selectSession = useCallback((session: Session) => {
    setActiveSession(normalizeSession(session));
  }, []);

  const removeSession = useCallback(async (id: string) => {
    await deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setActiveSession((prev) => (prev?.id === id ? null : prev));
  }, []);

  const updateSettings = useCallback((s: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...s };
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings.theme]);

  const updateActiveSession = useCallback(async (patch: Partial<Session>) => {
    let nextSession: Session | null = null;
    setActiveSession((prev) => {
      if (!prev) return prev;
      nextSession = { ...prev, ...patch };
      return nextSession;
    });

    if (nextSession) {
      await saveSession(nextSession);
      setSessions((prev) =>
        prev.map((session) => (session.id === nextSession?.id ? nextSession : session))
      );
    }
  }, []);

  const clearActiveSession = useCallback(() => {
    setActiveSession(null);
    setError(null);
  }, []);

  return {
    sessions,
    activeSession,
    settings,
    isLoading,
    error,
    loadSessions,
    startProcessing,
    selectSession,
    removeSession,
    updateSettings,
    updateActiveSession,
    clearActiveSession,
  };
}
