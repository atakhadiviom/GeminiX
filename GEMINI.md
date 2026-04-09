# GeminiX - Project Context

## Project Overview
GeminiX is a cross-platform desktop application that provides a graphical user interface for the **Gemini CLI**. It is designed to emulate the user experience of OpenAI Codex while leveraging Gemini's agentic capabilities.

### Architecture
- **Framework**: [Tauri 2](https://tauri.app/) (Rust backend, Webview frontend).
- **Frontend**: React 19 + TypeScript + Vite.
- **Backend**: Rust (Child process management, SQLite history, Shell integration).
- **CLI Integration**: Spawns `gemini chat --output-format stream-json` as a child process and pipes tokens to the UI via Tauri events.

## Building and Running

### Development
1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Run Development Server**:
    ```bash
    npm run tauri dev
    ```

### Production Build
```bash
npm run tauri build
```

### Testing
- **Rust Unit Tests**:
  ```bash
  cd src-tauri && cargo test
  ```
- **Smoke Test**:
  ```bash
  ./smoke-test.sh
  ```

## Key Technologies & Dependencies
- **Frontend**: `@tauri-apps/api`, `@tauri-apps/plugin-sql`, `@tauri-apps/plugin-shell`.
- **Backend (Rust)**: `tokio` (async runtime), `glob` (file searching), `tauri-plugin-sql` (SQLite), `tauri-plugin-shell`.
- **Backend (CLI)**: Requires the `gemini` CLI to be installed and available in the system PATH.

## Development Conventions

### Frontend Structure
- **`src/App.tsx`**: Main entry point for the chat UI, event listeners, and command invocations.
- **`src/App.css`**: Codex-inspired dark theme styling.

### Backend Structure
- **`src-tauri/src/lib.rs`**: Implementation of Tauri commands:
  - `spawn_gemini`: Initializes the CLI process.
  - `send_message`: Pipes user input to the CLI's stdin.
  - `list_files`: Provides file tree data for `@` mentions and sidebar.
  - `run_shell`: Executes local commands via `sh -c`.
  - `read_file`: Reads file content for context injection.

### State Management
- **Rust State**: Managed via the `GeminiState` struct, which holds a `Mutex` protected `Child` process and its `stdin`.
- **Persistence**: Message history is stored in a local SQLite database (`geminix.db`) via the SQL plugin.

### Communication Flow
1. UI calls `spawn_gemini`.
2. Rust backend starts the CLI and spawns background tasks to listen to `stdout`/`stderr`.
3. CLI emits JSON chunks; Rust emits `gemini-chunk` events to the UI.
4. UI parses JSON and updates the chat thread.
