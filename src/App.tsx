import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "./components/Sidebar";
import { RecordButton } from "./components/RecordButton";
import { TranscriptView } from "./components/TranscriptView";
import { SummaryView } from "./components/SummaryView";
import { SearchModal } from "./components/SearchModal";
import { SettingsModal } from "./components/SettingsModal";
import { useRecorder } from "./hooks/useRecorder";
import { useSession } from "./hooks/useSession";
import { exportToMarkdown } from "./lib/sessions";
import type { RecordingMode, Session } from "./lib/types";

type Tab = "transcript" | "summary";

export default function App() {
  const recorder = useRecorder();
  const sessionMgr = useSession();
  const [tab, setTab] = useState<Tab>("transcript");
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [recordingMode, setRecordingMode] = useState<RecordingMode>("lecture");
  const [flowError, setFlowError] = useState<string | null>(null);

  const handleStop = useCallback(async () => {
    try {
      setFlowError(null);
      const blob = await recorder.stopRecording();
      const data = Array.from(new Uint8Array(await blob.arrayBuffer()));
      const audioPath = await invoke<string>("save_audio", {
        data,
        filename: `studyflow_${Date.now()}.wav`,
      });
      await sessionMgr.startProcessing(audioPath, recorder.duration, recordingMode);
      setTab("summary");
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : "Kayıt işlenemedi.");
      setTab("transcript");
    }
  }, [recorder, recordingMode, sessionMgr]);

  const handleExport = useCallback(() => {
    if (!sessionMgr.activeSession) return;
    const md = exportToMarkdown(sessionMgr.activeSession);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sessionMgr.activeSession.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sessionMgr.activeSession]);

  const isLoading =
    sessionMgr.activeSession?.status === "transcribing" ||
    sessionMgr.activeSession?.status === "summarizing";

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowSearch(true);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const statusText =
    sessionMgr.activeSession?.status === "transcribing"
      ? "Transkript oluşturuluyor..."
      : sessionMgr.activeSession?.status === "summarizing"
      ? "Ollama ile özet hazırlanıyor..."
      : null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 text-gray-950 dark:bg-gray-950 dark:text-white">
      <Sidebar
        sessions={sessionMgr.sessions}
        activeId={sessionMgr.activeSession?.id ?? null}
        onSelect={(s: Session) => sessionMgr.selectSession(s)}
        onNewSession={sessionMgr.clearActiveSession}
        onSearch={() => setShowSearch(true)}
        onSettings={() => setShowSettings(true)}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-5">
            <RecordButton
              state={recorder.state}
              audioLevel={recorder.audioLevel}
              duration={recorder.duration}
              onStart={recorder.startRecording}
              onStop={handleStop}
            />
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-200 p-1 dark:bg-gray-900">
                {[
                  ["lecture", "Ders"],
                  ["meeting", "Toplantı"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setRecordingMode(value as RecordingMode)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      recordingMode === value
                        ? value === "lecture"
                          ? "bg-blue-600 text-white"
                          : "bg-purple-600 text-white"
                        : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {(recorder.error || sessionMgr.error || flowError) && (
                <span className="block text-sm text-red-500">
                  {recorder.error || sessionMgr.error || flowError}
                </span>
              )}
              {statusText && (
                <span className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
                  {statusText}
                </span>
              )}
            </div>
          </div>

          {sessionMgr.activeSession && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleExport}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-950 border border-gray-300 hover:border-gray-500 rounded-lg transition-colors dark:text-gray-400 dark:hover:text-white dark:border-gray-700 dark:hover:border-gray-500"
              >
                Markdown'a Aktar
              </button>
            </div>
          )}
        </header>

        {sessionMgr.activeSession ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-4 shrink-0">
              <h2 className="text-lg font-semibold text-white truncate">
                {sessionMgr.activeSession.title}
              </h2>
              <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                <span>
                  {new Date(sessionMgr.activeSession.createdAt).toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 ${
                    sessionMgr.activeSession.mode === "meeting"
                      ? "bg-purple-500/15 text-purple-300"
                      : "bg-blue-500/15 text-blue-300"
                  }`}
                >
                  {sessionMgr.activeSession.mode === "meeting" ? "Toplantı" : "Ders"}
                </span>
              </div>
            </div>

            <div className="px-6 pt-4 pb-2 shrink-0">
              <div className="flex gap-1 border-b border-gray-800">
                {(["transcript", "summary"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      tab === t
                        ? "text-white border-indigo-500"
                        : "text-gray-400 border-transparent hover:text-white"
                    }`}
                  >
                    {t === "transcript" ? "Transkript" : "Özet"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {tab === "transcript" ? (
                <TranscriptView
                  transcript={sessionMgr.activeSession.transcript}
                  isLoading={isLoading ?? false}
                  onChange={(transcript) =>
                    void sessionMgr.updateActiveSession({ transcript })
                  }
                />
              ) : (
                <SummaryView
                  summary={sessionMgr.activeSession.summary}
                  isLoading={isLoading ?? false}
                  actionItems={
                    sessionMgr.activeSession.mode === "meeting"
                      ? sessionMgr.activeSession.actionItems
                      : []
                  }
                  onExport={handleExport}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-500 text-sm">
                Modu seç, kayıt başlat ve StudyFlow transkript ile özeti lokalde hazırlasın.
              </p>
            </div>
          </div>
        )}
      </main>

      {showSearch && (
        <SearchModal
          onSelect={(s: Session) => {
            sessionMgr.selectSession(s);
            setShowSearch(false);
          }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={sessionMgr.settings}
          onUpdate={sessionMgr.updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
