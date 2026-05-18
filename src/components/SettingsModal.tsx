import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { ReactNode } from "react";
import type { Settings } from "../lib/types";

interface Props {
  settings: Settings;
  onUpdate: (s: Partial<Settings>) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onUpdate, onClose }: Props) {
  const pickFile = async (field: "whisperPath" | "modelPath") => {
    const selected = await openDialog({
      multiple: false,
      directory: false,
    });

    if (typeof selected === "string") {
      onUpdate({ [field]: selected });
    }
  };

  const openRecordingsFolder = async () => {
    try {
      await invoke("open_recordings_folder");
    } catch {
      // The button is only functional inside the Tauri desktop runtime.
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">Ayarlar</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Kapat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <Field label="Whisper CLI Yolu">
            <PathInput
              value={settings.whisperPath}
              onChange={(value) => onUpdate({ whisperPath: value })}
              onPick={() => pickFile("whisperPath")}
            />
          </Field>

          <Field label="Whisper Model Yolu">
            <PathInput
              value={settings.modelPath}
              onChange={(value) => onUpdate({ modelPath: value })}
              onPick={() => pickFile("modelPath")}
            />
          </Field>

          <Field label="Ollama Modeli">
            <input
              type="text"
              value={settings.ollamaModel}
              onChange={(e) => onUpdate({ ollamaModel: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </Field>

          <Field label="Dil">
            <select
              value={settings.language}
              onChange={(e) =>
                onUpdate({ language: e.target.value as Settings["language"] })
              }
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
              <option value="auto">Otomatik</option>
            </select>
          </Field>

          <Field label="Tema">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-800 p-1">
              {[
                ["dark", "Dark"],
                ["light", "Light"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => onUpdate({ theme: value as Settings["theme"] })}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    settings.theme === value
                      ? "bg-gray-700 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <button
            onClick={openRecordingsFolder}
            className="w-full rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
          >
            Kayıtlar klasörünü aç
          </button>
        </div>

        <div className="px-6 py-4 border-t border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-gray-400 text-xs font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function PathInput({
  value,
  onChange,
  onPick,
}: {
  value: string;
  onChange: (value: string) => void;
  onPick: () => void;
}) {
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <button
        onClick={onPick}
        className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
      >
        Seç
      </button>
    </div>
  );
}
