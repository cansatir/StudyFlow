import { useState, useRef, useCallback, useEffect } from "react";
import type { RecorderState } from "../lib/types";

interface UseRecorderReturn {
  state: RecorderState;
  audioLevel: number;
  waveform: number[];
  duration: number;
  audioBlob: Blob | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  error: string | null;
}

function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped * 0x7fff, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

async function resampleTo16kHz(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  audioCtx.close();

  const targetRate = 16000;
  const offline = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * targetRate),
    targetRate
  );
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

export function useRecorder(): UseRecorderReturn {
  const [state, setState] = useState<RecorderState>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const stopLevelLoop = useCallback(() => {
    if (levelTimerRef.current) clearInterval(levelTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    levelTimerRef.current = null;
    timerRef.current = null;
  }, []);

  useEffect(
    () => () => {
      stopLevelLoop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close();
    },
    [stopLevelLoop]
  );

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setAudioBlob(null);
      setWaveform([]);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      levelTimerRef.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArr);
        const avg = dataArr.reduce((a, b) => a + b, 0) / dataArr.length;
        const level = avg / 255;
        setAudioLevel(level);
        setWaveform((prev) => [...prev.slice(-47), level]);
      }, 100);

      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "";
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.start(250);
      mediaRecorderRef.current = mr;

      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      setState("recording");
    } catch (e) {
      setState("idle");
      setError(
        e instanceof Error
          ? e.message
          : "Mikrofon izni gerekli. Sistem ayarlarından izin ver."
      );
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob> => {
    setState("processing");
    stopLevelLoop();
    setAudioLevel(0);

    return new Promise((resolve, reject) => {
      const mr = mediaRecorderRef.current;
      if (!mr) {
        reject(new Error("MediaRecorder bulunamadı"));
        return;
      }

      mr.onstop = async () => {
        try {
          streamRef.current?.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunksRef.current, { type: mr.mimeType });
          const samples = await resampleTo16kHz(blob);
          const wav = encodeWav(samples, 16000);
          const wavBuffer = new ArrayBuffer(wav.byteLength);
          new Uint8Array(wavBuffer).set(wav);
          const wavBlob = new Blob([wavBuffer], { type: "audio/wav" });
          setAudioBlob(wavBlob);
          await audioContextRef.current?.close();
          audioContextRef.current = null;
          setState("idle");
          resolve(wavBlob);
        } catch (e) {
          setState("idle");
          const msg = e instanceof Error ? e.message : "Ses kaydedilemedi";
          setError(msg);
          reject(new Error(msg));
        }
      };

      mr.stop();
    });
  }, [stopLevelLoop]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      setState("paused");
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      setState("recording");
    }
  }, []);

  return {
    state,
    audioLevel,
    waveform,
    duration,
    audioBlob,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    error,
  };
}
