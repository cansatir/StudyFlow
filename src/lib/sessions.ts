import { invoke } from "@tauri-apps/api/core";
import type { Session } from "./types";

const WEB_SESSIONS_KEY = "studyflow.web.sessions";

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

function readWebSessions(): Session[] {
  try {
    const raw = window.localStorage.getItem(WEB_SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as Session[]) : [];
  } catch {
    return [];
  }
}

function writeWebSessions(sessions: Session[]) {
  window.localStorage.setItem(WEB_SESSIONS_KEY, JSON.stringify(sessions));
}

export async function listSessions(): Promise<Session[]> {
  if (!isTauriRuntime()) {
    return readWebSessions().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return invoke<Session[]>("list_sessions");
}

export async function loadSession(id: string): Promise<Session> {
  if (!isTauriRuntime()) {
    const session = readWebSessions().find((item) => item.id === id);
    if (!session) throw new Error("Oturum bulunamadı");
    return session;
  }

  return invoke<Session>("load_session", { id });
}

export async function saveSession(session: Session): Promise<void> {
  if (!isTauriRuntime()) {
    const sessions = readWebSessions();
    const next = [session, ...sessions.filter((item) => item.id !== session.id)];
    writeWebSessions(next);
    return;
  }

  return invoke<void>("save_session", { session });
}

export async function deleteSession(id: string): Promise<void> {
  if (!isTauriRuntime()) {
    writeWebSessions(readWebSessions().filter((session) => session.id !== id));
    return;
  }

  return invoke<void>("delete_session", { id });
}

export async function searchSessions(query: string): Promise<Session[]> {
  if (!isTauriRuntime()) {
    const q = query.toLowerCase();
    return readWebSessions().filter(
      (session) =>
        session.title.toLowerCase().includes(q) ||
        session.transcript.toLowerCase().includes(q) ||
        session.summary.toLowerCase().includes(q) ||
        session.keyPoints.some((point) => point.toLowerCase().includes(q)) ||
        session.actionItems.some((item) => item.toLowerCase().includes(q))
    );
  }

  return invoke<Session[]>("search_sessions", { query });
}

export function exportToMarkdown(session: Session): string {
  const date = new Date(session.createdAt).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const minutes = Math.max(1, Math.round(session.duration / 60));
  const mode = session.mode === "lecture" ? "Ders" : "Toplantı";
  const keyPoints = session.keyPoints.length
    ? session.keyPoints.map((point) => `- ${point}`).join("\n")
    : "- Henüz çıkarılmadı";
  const actionItems =
    session.mode === "meeting" && session.actionItems.length
      ? `\n## Görevler\n${session.actionItems.map((item) => `- [ ] ${item}`).join("\n")}\n`
      : "";

  return `# ${session.title}

**Tarih:** ${date}  
**Mod:** ${mode}  
**Süre:** ${minutes} dakika

---

## Özet

${session.summary}

## Ana Konular
${keyPoints}
${actionItems}

## Transkript

${session.transcript}
`;
}
