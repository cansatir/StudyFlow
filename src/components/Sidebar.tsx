import type { Session } from "../lib/types";

interface Props {
  sessions: Session[];
  activeId: string | null;
  onSelect: (session: Session) => void;
  onNewSession: () => void;
  onSearch: () => void;
  onSettings: () => void;
}

export function Sidebar({ sessions, activeId, onSelect, onNewSession, onSearch, onSettings }: Props) {
  return (
    <aside className="w-64 flex flex-col bg-gray-900 border-r border-gray-800 h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h1 className="text-white font-semibold text-lg">StudyFlow</h1>
        <div className="flex gap-1">
          <button
            onClick={onSearch}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
            aria-label="Arama"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
          <button
            onClick={onSettings}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
            aria-label="Ayarlar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-3 border-b border-gray-800">
        <button
          onClick={onNewSession}
          className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          Yeni Kayıt
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <p className="text-gray-500 text-xs text-center mt-8 px-4">
            Henüz kayıt yok. Kayıt yapmak için mikrofon butonuna tıkla.
          </p>
        ) : (
          <ul className="space-y-1">
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  onClick={() => onSelect(session)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                    activeId === session.id
                      ? "bg-indigo-900/50 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <div className="text-sm font-medium truncate">{session.title}</div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-gray-500">
                    <span>{new Date(session.createdAt).toLocaleDateString("tr-TR")}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 ${
                        session.mode === "meeting"
                          ? "bg-purple-500/15 text-purple-300"
                          : "bg-blue-500/15 text-blue-300"
                      }`}
                    >
                      {session.mode === "meeting" ? "Toplantı" : "Ders"}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}
