use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;

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
