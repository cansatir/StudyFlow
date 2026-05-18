import ReactMarkdown from "react-markdown";

interface Props {
  summary: string;
  isLoading: boolean;
  actionItems: string[];
  onExport: () => void;
}

export function SummaryView({ summary, isLoading, actionItems, onExport }: Props) {
  const copySummary = async () => {
    await navigator.clipboard.writeText(summary);
  };

  if (isLoading && !summary) {
    return (
      <div className="flex items-center gap-3 text-gray-400 py-8">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">Özet oluşturuluyor...</span>
      </div>
    );
  }

  if (!summary) {
    return (
      <p className="text-gray-500 text-sm py-8 text-center">
        Özet henüz mevcut değil.
      </p>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onExport}
          className="px-3 py-1.5 text-xs text-gray-300 hover:text-white border border-gray-700 hover:border-gray-500 rounded-md transition-colors"
        >
          Markdown indir
        </button>
        <button
          onClick={copySummary}
          className="px-3 py-1.5 text-xs text-gray-300 hover:text-white border border-gray-700 hover:border-gray-500 rounded-md transition-colors"
        >
          Kopyala
        </button>
      </div>

      {actionItems.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Görevler</h3>
          <div className="space-y-2">
            {actionItems.map((item) => (
              <label key={item} className="flex items-start gap-3 text-sm text-gray-300">
                <input type="checkbox" className="mt-1 accent-green-500" />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-none text-sm leading-relaxed text-gray-300 [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_p]:mb-3">
        <ReactMarkdown>{summary}</ReactMarkdown>
      </div>
    </section>
  );
}
