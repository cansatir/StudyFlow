# StudyFlow

Record lectures and meetings. Transcribe with Whisper. Summarize with Llama. Zero cloud. Zero API key.

## Features

- Desktop app for macOS and Windows with Tauri v2.
- React, TypeScript, and Tailwind CSS interface.
- Local microphone recording with WAV export for Whisper.
- Local transcription through `whisper.cpp`.
- Local summaries and titles through Ollama on `localhost:11434`.
- Lecture and meeting modes with different markdown summary formats.
- Editable transcripts, markdown export, full-text search, and local JSON session storage.
- Dark mode by default with a light mode toggle.

## Installation

### Prerequisites

- Rust and Cargo
- Node.js 18+
- `whisper.cpp` CLI at `/usr/local/bin/whisper-cpp` or available in `PATH`
- Whisper model at `~/.studyflow/models/ggml-large-v3-turbo.bin`
- Ollama running on `localhost:11434`
- Ollama model `llama3.2`

### Setup

```bash
npm install
npm run tauri dev
```

If you are creating the project from scratch, the equivalent setup commands are:

```bash
npm create tauri-app@latest studyflow -- --template react-ts --manager npm
cd studyflow
npm install
npm install tailwindcss @tailwindcss/vite
npm install react-markdown
npm install @tauri-apps/plugin-store
npm install @tauri-apps/plugin-fs
npm install @tauri-apps/plugin-dialog
npm install @tauri-apps/plugin-shell
```

Ollama should be running before summarization:

```bash
ollama serve
ollama pull llama3.2
```

Place the Whisper model at:

```bash
mkdir -p ~/.studyflow/models
# copy ggml-large-v3-turbo.bin to ~/.studyflow/models/
```

## Usage

![StudyFlow main window](docs/screenshot-main.png)

1. Choose `Ders` or `Toplantı`.
2. Press the record button and speak.
3. Stop recording to save audio locally under `~/.studyflow/recordings/`.
4. StudyFlow transcribes with Whisper and summarizes with Ollama.
5. Edit the transcript, search sessions with `Cmd+K` or `Ctrl+K`, and export markdown.

![StudyFlow settings](docs/screenshot-settings.png)

Use Settings to change the Whisper binary path, Whisper model path, Ollama model, default language, and theme.

## Roadmap

- Mobile app
- Semantic search
- Speaker diarization

## Contributing

Issues and pull requests are welcome. Keep the app local-first: no cloud APIs, no API keys, and no `.env` requirements.

## License

MIT
