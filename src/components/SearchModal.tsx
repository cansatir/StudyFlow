import { useState, useCallback, useEffect } from "react";
import type { Session } from "../lib/types";
import { searchSessions } from "../lib/sessions";

interface Props {
  onSelect: (session: Session) => void;
  onClose: () => void;
}

export function SearchModal({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Session[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const found = await searchSessions(q);
      setResults(found);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const snippetFor = (session: Session) => {
    const lowerQuery = query.toLowerCase();
    const text = `${session.title}\n${session.transcript}\n${session.summary}`;
    const index = text.toLowerCase().indexOf(lowerQuery);
    if (index < 0) return session.transcript.slice(0, 120);
    const start = Math.max(0, index - 45);
    const end = Math.min(text.length, index + query.length + 75);
    return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-start justify-center pt-20 z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
          <svg
            className="w-4 h-4 text-gray-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kayıtlarda ara..."
            className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
          />
          {isSearching && (
            <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>

        {results.length > 0 && (
          <ul className="max-h-80 overflow-y-auto py-2">
            {results.map((session) => (
              <li key={session.id}>
                <button
                  onClick={() => {
                    onSelect(session);
                    onClose();
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-white">{session.title}</div>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${
                        session.mode === "meeting"
                          ? "bg-purple-500/15 text-purple-300"
                          : "bg-blue-500/15 text-blue-300"
                      }`}
                    >
                      {session.mode === "meeting" ? "Toplantı" : "Ders"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {new Date(session.createdAt).toLocaleDateString("tr-TR")}
                  </div>
                  <div className="text-xs text-gray-400 mt-1 truncate">
                    {snippetFor(session)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {query && !isSearching && results.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">Sonuç bulunamadı.</p>
        )}
      </div>
    </div>
  );
}
