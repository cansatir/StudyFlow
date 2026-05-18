import type { RecorderState } from "../lib/types";

interface Props {
  state: RecorderState;
  audioLevel: number;
  duration: number;
  onStart: () => void;
  onStop: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function RecordButton({ state, audioLevel, duration, onStart, onStop }: Props) {
  const isRecording = state === "recording";
  const isProcessing = state === "processing";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex items-center justify-center">
        {isRecording && (
          <div
            className="absolute rounded-full bg-red-500/30 animate-pulse-ring"
            style={{
              width: `${80 + audioLevel * 40}px`,
              height: `${80 + audioLevel * 40}px`,
            }}
          />
        )}
        <button
          onClick={isRecording ? onStop : onStart}
          disabled={isProcessing}
          className={`
            relative z-10 w-20 h-20 rounded-full flex items-center justify-center
            transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900
            ${
              isRecording
                ? "bg-red-600 hover:bg-red-700 focus:ring-red-500 shadow-lg shadow-red-900/50"
                : isProcessing
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 shadow-lg shadow-indigo-900/50"
            }
          `}
          aria-label={isRecording ? "Kaydı durdur" : "Kayıt başlat"}
        >
          {isProcessing ? (
            <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : isRecording ? (
            <div className="w-7 h-7 bg-white rounded-sm" />
          ) : (
            <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V6z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          )}
        </button>
      </div>

      {isRecording && (
        <div className="flex items-center gap-2 text-red-400 text-sm font-mono tabular-nums">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          {formatDuration(duration)}
        </div>
      )}

      {isProcessing && <p className="text-gray-400 text-sm">İşleniyor...</p>}
    </div>
  );
}
