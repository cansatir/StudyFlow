use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

static RECORDER: Lazy<Mutex<Option<RecorderController>>> = Lazy::new(|| Mutex::new(None));

struct NativeRecorder {
    stream: cpal::Stream,
    samples: Arc<Mutex<Vec<f32>>>,
    sample_rate: u32,
    started_at: Instant,
}

struct RecorderController {
    stop_tx: mpsc::Sender<PathBuf>,
    result_rx: mpsc::Receiver<Result<NativeRecordingResult, String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Session {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub mode: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    pub duration: u64,
    #[serde(rename = "audioPath")]
    pub audio_path: String,
    pub transcript: String,
    pub summary: String,
    #[serde(default, rename = "keyPoints")]
    pub key_points: Vec<String>,
    #[serde(default, rename = "actionItems")]
    pub action_items: Vec<String>,
    pub status: String,
}

#[derive(Debug, Serialize)]
struct NativeRecordingResult {
    #[serde(rename = "audioPath")]
    audio_path: String,
    duration: u64,
}

fn studyflow_dir() -> PathBuf {
    dirs::home_dir()
        .expect("Could not find home directory")
        .join(".studyflow")
}

fn sessions_dir() -> PathBuf {
    studyflow_dir().join("sessions")
}

fn recordings_dir() -> PathBuf {
    studyflow_dir().join("recordings")
}

fn expand_tilde(path: &str) -> PathBuf {
    if let Some(rest) = path.strip_prefix("~/") {
        return studyflow_dir()
            .parent()
            .map(|home| home.join(rest))
            .unwrap_or_else(|| PathBuf::from(path));
    }

    PathBuf::from(path)
}

fn ensure_dirs() -> Result<(), String> {
    let base = studyflow_dir();
    for dir in [
        base.clone(),
        sessions_dir(),
        recordings_dir(),
        base.join("models"),
    ] {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn append_f32_samples(input: &[f32], samples: &Arc<Mutex<Vec<f32>>>, channels: u16) {
    if let Ok(mut guard) = samples.lock() {
        if channels <= 1 {
            guard.extend(input.iter().copied());
            return;
        }

        for frame in input.chunks(channels as usize) {
            let sum: f32 = frame.iter().copied().sum();
            guard.push(sum / frame.len() as f32);
        }
    }
}

fn append_i16_samples(input: &[i16], samples: &Arc<Mutex<Vec<f32>>>, channels: u16) {
    if let Ok(mut guard) = samples.lock() {
        for frame in input.chunks(channels as usize) {
            let sum: f32 = frame
                .iter()
                .map(|sample| *sample as f32 / i16::MAX as f32)
                .sum();
            guard.push(sum / frame.len() as f32);
        }
    }
}

fn append_u16_samples(input: &[u16], samples: &Arc<Mutex<Vec<f32>>>, channels: u16) {
    if let Ok(mut guard) = samples.lock() {
        for frame in input.chunks(channels as usize) {
            let sum: f32 = frame
                .iter()
                .map(|sample| (*sample as f32 - 32768.0) / 32768.0)
                .sum();
            guard.push(sum / frame.len() as f32);
        }
    }
}

fn write_wav(path: PathBuf, samples: &[f32], sample_rate: u32) -> Result<(), String> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::create(path, spec).map_err(|e| e.to_string())?;

    for sample in samples {
        let clamped = sample.clamp(-1.0, 1.0);
        writer
            .write_sample((clamped * i16::MAX as f32) as i16)
            .map_err(|e| e.to_string())?;
    }

    writer.finalize().map_err(|e| e.to_string())
}

#[tauri::command]
fn start_native_recording() -> Result<(), String> {
    ensure_dirs()?;

    let mut recorder = RECORDER.lock().map_err(|e| e.to_string())?;
    if recorder.is_some() {
        return Err("Kayıt zaten devam ediyor.".to_string());
    }

    let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();
    let (stop_tx, stop_rx) = mpsc::channel::<PathBuf>();
    let (result_tx, result_rx) = mpsc::channel::<Result<NativeRecordingResult, String>>();

    thread::spawn(move || {
        let setup_result = create_native_recorder();
        match setup_result {
            Ok(native) => {
                let _ = ready_tx.send(Ok(()));
                let result = match stop_rx.recv() {
                    Ok(path) => finish_native_recording(native, path),
                    Err(_) => Err("Kayıt durdurma sinyali alınamadı.".to_string()),
                };
                let _ = result_tx.send(result);
            }
            Err(error) => {
                let _ = ready_tx.send(Err(error));
            }
        }
    });

    match ready_rx.recv_timeout(Duration::from_secs(10)) {
        Ok(Ok(())) => {
            *recorder = Some(RecorderController { stop_tx, result_rx });
            Ok(())
        }
        Ok(Err(error)) => Err(error),
        Err(_) => Err("Mikrofon başlatma zaman aşımına uğradı.".to_string()),
    }
}

#[tauri::command]
fn stop_native_recording(filename: String) -> Result<NativeRecordingResult, String> {
    ensure_dirs()?;

    let controller = RECORDER
        .lock()
        .map_err(|e| e.to_string())?
        .take()
        .ok_or_else(|| "Devam eden kayıt bulunamadı.".to_string())?;

    let path = recordings_dir().join(filename);
    controller
        .stop_tx
        .send(path)
        .map_err(|_| "Kayıt durdurulamadı.".to_string())?;

    controller
        .result_rx
        .recv_timeout(Duration::from_secs(30))
        .map_err(|_| "Kayıt dosyası yazma zaman aşımına uğradı.".to_string())?
}

fn create_native_recorder() -> Result<NativeRecorder, String> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| "Mikrofon bulunamadı. Giriş cihazını kontrol et.".to_string())?;
    let supported_config = device
        .default_input_config()
        .map_err(|e| format!("Mikrofon yapılandırması alınamadı: {}", e))?;
    let sample_rate = supported_config.sample_rate().0;
    let channels = supported_config.channels();
    let stream_config: cpal::StreamConfig = supported_config.clone().into();
    let samples = Arc::new(Mutex::new(Vec::<f32>::new()));
    let err_fn = |_err| {};

    let stream = match supported_config.sample_format() {
        cpal::SampleFormat::F32 => {
            let samples = Arc::clone(&samples);
            device.build_input_stream(
                &stream_config,
                move |data: &[f32], _| append_f32_samples(data, &samples, channels),
                err_fn,
                None,
            )
        }
        cpal::SampleFormat::I16 => {
            let samples = Arc::clone(&samples);
            device.build_input_stream(
                &stream_config,
                move |data: &[i16], _| append_i16_samples(data, &samples, channels),
                err_fn,
                None,
            )
        }
        cpal::SampleFormat::U16 => {
            let samples = Arc::clone(&samples);
            device.build_input_stream(
                &stream_config,
                move |data: &[u16], _| append_u16_samples(data, &samples, channels),
                err_fn,
                None,
            )
        }
        _ => return Err("Bu mikrofon örnek formatı desteklenmiyor.".to_string()),
    }
    .map_err(|e| format!("Mikrofon kaydı başlatılamadı: {}", e))?;

    stream
        .play()
        .map_err(|e| format!("Mikrofon akışı başlatılamadı: {}", e))?;

    Ok(NativeRecorder {
        stream,
        samples,
        sample_rate,
        started_at: Instant::now(),
    })
}

fn finish_native_recording(native: NativeRecorder, path: PathBuf) -> Result<NativeRecordingResult, String> {
    let duration = native.started_at.elapsed().as_secs();
    drop(native.stream);

    let samples = native.samples.lock().map_err(|e| e.to_string())?.clone();
    if samples.is_empty() {
        return Err("Kayıt boş görünüyor. Mikrofon iznini ve giriş cihazını kontrol et.".to_string());
    }

    write_wav(path.clone(), &samples, native.sample_rate)?;

    Ok(NativeRecordingResult {
        audio_path: path.to_string_lossy().to_string(),
        duration,
    })
}

#[tauri::command]
fn save_audio(filename: String, data: Vec<u8>) -> Result<String, String> {
    ensure_dirs()?;
    let path = recordings_dir().join(&filename);
    fs::write(&path, &data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn transcribe(
    audio_path: String,
    language: String,
    whisper_path: String,
    model_path: String,
) -> Result<String, String> {
    ensure_dirs()?;

    if !std::path::Path::new(&audio_path).exists() {
        return Err("Ses dosyası bulunamadı.".to_string());
    }

    let model_path = expand_tilde(&model_path);
    if !model_path.exists() {
        return Err("Whisper model dosyası bulunamadı. Ayarlar'dan model yolunu gir.".to_string());
    }

    let output_base = std::env::temp_dir().join(format!(
        "studyflow_transcript_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis()
    ));

    let mut args = vec![
        "-m".to_string(),
        model_path.to_string_lossy().to_string(),
        "-f".to_string(),
        audio_path,
        "-otxt".to_string(),
        "-nt".to_string(),
        "-of".to_string(),
        output_base.to_string_lossy().to_string(),
    ];

    if language != "auto" {
        args.push("-l".to_string());
        args.push(language);
    }

    let output = Command::new(&whisper_path)
        .args(args)
        .output()
        .map_err(|e| format!("Whisper çalıştırılamadı. Ayarlar'dan whisper.cpp yolunu gir. Detay: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Whisper transkripsiyonu başarısız: {}", stderr.trim()));
    }

    let txt_path = output_base.with_extension("txt");
    let transcript = fs::read_to_string(&txt_path)
        .map_err(|e| format!("Transkript dosyası okunamadı: {}", e))?;

    let _ = fs::remove_file(&txt_path);

    Ok(transcript.trim().to_string())
}

#[tauri::command]
fn open_recordings_folder() -> Result<(), String> {
    ensure_dirs()?;
    let path = recordings_dir();

    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn save_session(session: Session) -> Result<(), String> {
    ensure_dirs()?;
    let path = sessions_dir().join(format!("{}.json", session.id));
    let json = serde_json::to_string_pretty(&session).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_session(id: String) -> Result<Session, String> {
    let path = sessions_dir().join(format!("{}.json", id));
    let json = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let session: Session = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    Ok(session)
}

#[tauri::command]
fn list_sessions() -> Result<Vec<Session>, String> {
    ensure_dirs()?;
    let dir = sessions_dir();
    let mut sessions: Vec<Session> = Vec::new();

    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Ok(json) = fs::read_to_string(&path) {
                if let Ok(session) = serde_json::from_str::<Session>(&json) {
                    sessions.push(session);
                }
            }
        }
    }

    sessions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(sessions)
}

#[tauri::command]
fn delete_session(id: String) -> Result<(), String> {
    let path = sessions_dir().join(format!("{}.json", id));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn search_sessions(query: String) -> Result<Vec<Session>, String> {
    let all = list_sessions()?;
    let q = query.to_lowercase();
    let results = all
        .into_iter()
        .filter(|s| {
            s.title.to_lowercase().contains(&q)
            || s.transcript.to_lowercase().contains(&q)
            || s.summary.to_lowercase().contains(&q)
                || s.key_points.iter().any(|t| t.to_lowercase().contains(&q))
                || s.action_items.iter().any(|t| t.to_lowercase().contains(&q))
        })
        .collect();
    Ok(results)
}

pub fn run() {
    tauri::Builder::default()
        .setup(|_| {
            ensure_dirs()
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            start_native_recording,
            stop_native_recording,
            save_audio,
            transcribe,
            open_recordings_folder,
            save_session,
            load_session,
            list_sessions,
            delete_session,
            search_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
