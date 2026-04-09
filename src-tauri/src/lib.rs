use serde::Serialize;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};

const GEMINI_CHUNK_EVENT: &str = "gemini-chunk";
const GEMINI_DONE_EVENT: &str = "gemini-done";
const GEMINI_ERROR_EVENT: &str = "gemini-error";
const SKIP_DIRS: [&str; 4] = ["node_modules", ".git", "__pycache__", "target"];

#[derive(Default)]
pub struct GeminiState {
    child: Mutex<Option<Child>>,
    workspace: Mutex<Option<PathBuf>>,
    config: Mutex<RuntimeConfig>,
}

#[derive(Default, Clone)]
struct RuntimeConfig {
    model: String,
    api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileEntry {
    name: String,
    path: String,
    relative_path: String,
    is_dir: bool,
    children: Vec<FileEntry>,
}

#[tauri::command]
async fn set_runtime_config(
    state: State<'_, GeminiState>,
    model: String,
    api_key: Option<String>,
) -> Result<(), String> {
    let mut config = state.config.lock().await;
    config.model = if model.trim().is_empty() {
        "gemini-2.5-pro".to_string()
    } else {
        model
    };
    config.api_key = api_key.filter(|value| !value.trim().is_empty());
    Ok(())
}

#[tauri::command]
async fn spawn_gemini(
    app: AppHandle,
    state: State<'_, GeminiState>,
    prompt: String,
    files: Vec<String>,
) -> Result<(), String> {
    kill_active_child(state.inner()).await?;

    let workspace = current_workspace(state.inner()).await?;
    let config = {
        let config = state.config.lock().await;
        RuntimeConfig {
            model: if config.model.trim().is_empty() {
                "gemini-2.5-pro".to_string()
            } else {
                config.model.clone()
            },
            api_key: config.api_key.clone(),
        }
    };

    let gemini_path = resolve_gemini_binary()?;
    let full_prompt = build_prompt_with_files(&prompt, &files);

    let mut command = Command::new(gemini_path);
    command
        .arg("--model")
        .arg(config.model)
        .arg("--output_format")
        .arg("stream_json")
        .current_dir(workspace)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(api_key) = config.api_key {
        command.env("GOOGLE_API_KEY", api_key);
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("Failed to spawn Gemini CLI: {error}"))?;

    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Failed to capture Gemini stdin".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture Gemini stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture Gemini stderr".to_string())?;

    stdin
        .write_all(full_prompt.as_bytes())
        .await
        .map_err(|error| format!("Failed to write prompt to Gemini: {error}"))?;
    stdin
        .shutdown()
        .await
        .map_err(|error| format!("Failed to finalize Gemini prompt: {error}"))?;

    {
        let mut child_guard = state.child.lock().await;
        *child_guard = Some(child);
    }

    let stderr_buffer = Arc::new(Mutex::new(String::new()));
    let stderr_clone = Arc::clone(&stderr_buffer);
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let mut buffer = stderr_clone.lock().await;
            if !buffer.is_empty() {
                buffer.push('\n');
            }
            buffer.push_str(&line);
        }
    });

    let stdout_app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = stdout_app.emit(GEMINI_CHUNK_EVENT, line);
        }
    });

    let monitor_app = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            let status = {
                let state = monitor_app.state::<GeminiState>();
                let mut child_guard = state.child.lock().await;
                match child_guard.as_mut() {
                    Some(child) => match child.try_wait() {
                        Ok(Some(status)) => {
                            *child_guard = None;
                            Some(status)
                        }
                        Ok(None) => None,
                        Err(error) => {
                            let _ = monitor_app.emit(
                                GEMINI_ERROR_EVENT,
                                format!("Failed while monitoring Gemini: {error}"),
                            );
                            *child_guard = None;
                            return;
                        }
                    },
                    None => return,
                }
            };

            if let Some(exit_status) = status {
                if exit_status.success() {
                    let _ = monitor_app.emit(GEMINI_DONE_EVENT, true);
                } else {
                    let stderr_output = stderr_buffer.lock().await.clone();
                    let message = if stderr_output.trim().is_empty() {
                        format!(
                            "Gemini exited with status {}",
                            exit_status.code().unwrap_or_default()
                        )
                    } else {
                        stderr_output
                    };
                    let _ = monitor_app.emit(GEMINI_ERROR_EVENT, message);
                }
                return;
            }

            sleep(Duration::from_millis(120)).await;
        }
    });

    Ok(())
}

#[tauri::command]
async fn kill_gemini(state: State<'_, GeminiState>) -> Result<(), String> {
    kill_active_child(state.inner()).await
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|error| format!("Failed to read {path}: {error}"))
}

#[tauri::command]
async fn list_directory(
    state: State<'_, GeminiState>,
    path: String,
) -> Result<Vec<FileEntry>, String> {
    let root = PathBuf::from(&path);
    if !root.exists() {
        return Err(format!("Directory does not exist: {path}"));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a directory: {path}"));
    }

    let canonical_root = root
        .canonicalize()
        .map_err(|error| format!("Failed to resolve directory {path}: {error}"))?;

    {
        let mut workspace = state.workspace.lock().await;
        *workspace = Some(canonical_root.clone());
    }

    build_directory_tree(&canonical_root, &canonical_root)
}

#[tauri::command]
async fn run_shell(state: State<'_, GeminiState>, cmd: String) -> Result<String, String> {
    let workspace = current_workspace(state.inner()).await?;
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", &cmd])
            .current_dir(workspace)
            .output()
            .await
            .map_err(|error| format!("Failed to run shell command: {error}"))?
    } else {
        Command::new("sh")
            .args(["-lc", &cmd])
            .current_dir(workspace)
            .output()
            .await
            .map_err(|error| format!("Failed to run shell command: {error}"))?
    };

    let mut combined = String::new();
    if !output.stdout.is_empty() {
        combined.push_str(&String::from_utf8_lossy(&output.stdout));
    }
    if !output.stderr.is_empty() {
        if !combined.is_empty() {
            combined.push('\n');
        }
        combined.push_str(&String::from_utf8_lossy(&output.stderr));
    }

    if combined.trim().is_empty() {
        combined = format!(
            "Command finished with exit code {} and produced no output.",
            output.status.code().unwrap_or_default()
        );
    }

    Ok(combined)
}

async fn current_workspace(state: &GeminiState) -> Result<PathBuf, String> {
    let workspace = state.workspace.lock().await;
    workspace
        .clone()
        .ok_or_else(|| "Open a workspace folder before running Gemini.".to_string())
}

async fn kill_active_child(state: &GeminiState) -> Result<(), String> {
    let mut child_guard = state.child.lock().await;
    if let Some(child) = child_guard.as_mut() {
        child
            .start_kill()
            .map_err(|error| format!("Failed to kill Gemini process: {error}"))?;
    }
    *child_guard = None;
    Ok(())
}

fn build_prompt_with_files(prompt: &str, files: &[String]) -> String {
    if files.is_empty() {
        return prompt.to_string();
    }

    let mut context = String::from("Attached workspace context:\n\n");
    for path in files {
        match fs::read_to_string(path) {
            Ok(content) => {
                context.push_str(&format!("===== FILE: {path} =====\n{content}\n\n"));
            }
            Err(error) => {
                context.push_str(&format!(
                    "===== FILE: {path} =====\n[Unable to read file: {error}]\n\n"
                ));
            }
        }
    }
    context.push_str("===== USER PROMPT =====\n");
    context.push_str(prompt);
    context
}

fn build_directory_tree(root: &Path, current: &Path) -> Result<Vec<FileEntry>, String> {
    let mut entries = fs::read_dir(current)
        .map_err(|error| format!("Failed to read directory {}: {error}", current.display()))?
        .filter_map(Result::ok)
        .filter(|entry| !should_skip(entry.path()))
        .collect::<Vec<_>>();

    entries.sort_by(|left, right| {
        let left_is_dir = left.path().is_dir();
        let right_is_dir = right.path().is_dir();
        right_is_dir
            .cmp(&left_is_dir)
            .then_with(|| left.file_name().cmp(&right.file_name()))
    });

    entries
        .into_iter()
        .map(|entry| {
            let path = entry.path();
            let is_dir = path.is_dir();
            let children = if is_dir {
                build_directory_tree(root, &path)?
            } else {
                Vec::new()
            };

            let relative_path = path
                .strip_prefix(root)
                .map_err(|error| error.to_string())?
                .to_string_lossy()
                .replace('\\', "/");

            Ok(FileEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                path: path.to_string_lossy().into_owned(),
                relative_path,
                is_dir,
                children,
            })
        })
        .collect()
}

fn should_skip(path: PathBuf) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| SKIP_DIRS.contains(&name))
        .unwrap_or(false)
}

fn resolve_gemini_binary() -> Result<PathBuf, String> {
    let path_value = env::var_os("PATH").ok_or_else(|| {
        "Gemini CLI is not installed or PATH is not available. Install it first and restart GeminiX.".to_string()
    })?;

    let executable_names = if cfg!(target_os = "windows") {
        vec!["gemini.exe", "gemini.cmd", "gemini.bat", "gemini"]
    } else {
        vec!["gemini"]
    };

    for directory in env::split_paths(&path_value) {
        for executable in &executable_names {
            let candidate = directory.join(executable);
            if candidate.is_file() {
                return Ok(candidate);
            }
        }
    }

    Err(
        "Gemini CLI was not found in PATH. Install it and make sure `gemini --help` works in your terminal.".to_string(),
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(GeminiState {
            child: Mutex::new(None),
            workspace: Mutex::new(None),
            config: Mutex::new(RuntimeConfig {
                model: "gemini-2.5-pro".to_string(),
                api_key: None,
            }),
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                let app = window.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(state) = app.try_state::<GeminiState>() {
                        let _ = kill_active_child(state.inner()).await;
                    }
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            set_runtime_config,
            spawn_gemini,
            kill_gemini,
            read_file,
            list_directory,
            run_shell
        ])
        .run(tauri::generate_context!())
        .expect("error while running GeminiX");
}
