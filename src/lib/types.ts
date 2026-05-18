export type RecordingMode = "lecture" | "meeting";
export type RecorderState = "idle" | "recording" | "paused" | "processing";
export type SessionStatus = "recording" | "transcribing" | "summarizing" | "done" | "error";

export interface Session {
  id: string;
  title: string;
  mode: RecordingMode;
  createdAt: string;
  duration: number;
  audioPath: string;
  transcript: string;
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  status: SessionStatus;
}

export interface Settings {
  whisperPath: string;
  modelPath: string;
  ollamaModel: string;
  language: "tr" | "en" | "auto";
  theme: "dark" | "light";
}

export interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}
