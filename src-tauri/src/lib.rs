use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::Mutex;

#[derive(Default)]
pub struct GeminiState {
    pub child: Mutex<Option<Child>>,
    pub stdin: Mutex<Option<ChildStdin>>,
}

#[derive(Serialize, Clone)]
struct GeminiChunk {
    chunk: String,
    stream: String, // "stdout" or "stderr"
}

#[tauri::command]
async fn spawn_gemini(
    app: AppHandle,
    state: State<'_, GeminiState>,
    model: Option<String>,
    resume: bool,
) -> Result<String, String> {
    let mut args = vec![
        "chat".to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
    ];
    if let Some(m) = model {
        args.push("--model".to_string());
        args.push(m);
    }
    if resume {
        args.push("--resume".to_string());
        args.push("latest".to_string());
    }

    let mut child = Command::new("gemini")
        .args(args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn gemini CLI: {}", e))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let stdin = child.stdin.take().unwrap();

    // Store child and stdin in state
    *state.child.lock().await = Some(child);
    *state.stdin.lock().await = Some(stdin);

    // Read stdout in a background task
    let app_stdout = app.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            app_stdout
                .emit(
                    "gemini-chunk",
                    GeminiChunk {
                        chunk: line,
                        stream: "stdout".to_string(),
                    },
                )
                .unwrap_or_else(|e| eprintln!("Failed to emit event: {}", e));
        }
    });

    // Read stderr in a background task
    let app_stderr = app.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            app_stderr
                .emit(
                    "gemini-chunk",
                    GeminiChunk {
                        chunk: line,
                        stream: "stderr".to_string(),
                    },
                )
                .unwrap_or_else(|e| eprintln!("Failed to emit event: {}", e));
        }
    });

    Ok("Gemini process spawned".to_string())
}

#[tauri::command]
async fn send_message(state: State<'_, GeminiState>, message: String) -> Result<(), String> {
    let mut stdin_lock = state.stdin.lock().await;
    if let Some(stdin) = stdin_lock.as_mut() {
        stdin
            .write_all(message.as_bytes())
            .await
            .map_err(|e| e.to_string())?;
        stdin.write_all(b"\n").await.map_err(|e| e.to_string())?;
        stdin.flush().await.map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Gemini process not running".to_string())
    }
}

#[tauri::command]
fn list_files() -> Vec<String> {
    use glob::glob;
    let pattern = "**/*";
    glob(pattern)
        .expect("Failed to read glob pattern")
        .filter_map(|entry| entry.ok())
        .filter(|path| path.is_file())
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

#[tauri::command]
async fn run_shell(command: String) -> Result<String, String> {
    let out = Command::new("sh")
        .args(&["-c", &command])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let res = String::from_utf8_lossy(&out.stdout).into_owned()
        + &String::from_utf8_lossy(&out.stderr).into_owned();
    Ok(res)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(GeminiState::default())
        .invoke_handler(tauri::generate_handler![
            spawn_gemini,
            send_message,
            list_files,
            run_shell,
            read_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_list_files() {
        let files = list_files();
        assert!(files.len() > 0);
        // During tests, current dir might be src-tauri, so check for Cargo.toml
        assert!(files.iter().any(|f| f.contains("Cargo.toml")));
    }
}
