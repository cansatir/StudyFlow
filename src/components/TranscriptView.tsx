interface Props {
  transcript: string;
  isLoading: boolean;
  onChange: (transcript: string) => void;
}

export function TranscriptView({ transcript, isLoading, onChange }: Props) {
  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const copyTranscript = async () => {
    await navigator.clipboard.writeText(transcript);
  };

  if (isLoading && !transcript) {
    return (
      <div className="flex items-center gap-3 text-gray-400 py-8">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">Transkript oluşturuluyor...</span>
      </div>
    );
  }

  if (!transcript) {
    return (
      <p className="text-gray-500 text-sm py-8 text-center">
        Transkript henüz mevcut değil.
      </p>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500">{wordCount} kelime</span>
        <button
          onClick={copyTranscript}
          className="px-3 py-1.5 text-xs text-gray-300 hover:text-white border border-gray-700 hover:border-gray-500 rounded-md transition-colors"
        >
          Kopyala
        </button>
      </div>
      <textarea
        value={transcript}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[420px] w-full resize-y rounded-lg border border-gray-800 bg-gray-900/70 p-4 text-sm leading-relaxed text-gray-200 outline-none transition-colors focus:border-blue-500"
      />
    </section>
  );
}
