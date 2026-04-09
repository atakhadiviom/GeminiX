# GeminiX

GeminiX is a cross-platform desktop AI coding assistant shell, designed to look and feel like OpenAI Codex while using the **Gemini CLI** as its powerful backend.

Built with **Tauri 2**, GeminiX is lightweight, fast, and secure. It interacts directly with your local `gemini` installation, providing a seamless bridge between a high-end web UI and the CLI's advanced agentic capabilities.

## ✨ Key Features

- **Codex Aesthetic**: A clean, near-black terminal interface using JetBrains Mono for optimal readability.
- **Dynamic Context Injection**:
  - **`@` Mention**: Fuzzy search and inject file paths directly into your prompts.
  - **Sidebar File Explorer**: One-click injection of entire file contents into the chat context.
- **Integrated Shell (`!`)**: Run local shell commands (e.g., `!npm test`, `!ls -la`) directly from the chat and feed the output back to the AI.
- **Session Persistence**: Automatic message history stored in a local SQLite database.
- **Resume Capabilities**: Continue your last session with a single click using the native `--resume` CLI flag.
- **Model Switching**: Easily toggle between Gemini models (Flash, Pro, Experimental) before or during a session.
- **Streaming UI**: Real-time token streaming for a responsive, "alive" experience.

## 🚀 Getting Started

### Prerequisites

1.  **Gemini CLI**: Ensure you have the [Gemini CLI](https://geminicli.com) installed and authenticated.
    ```bash
    gemini --version
    ```
2.  **API Key**: Set your `GOOGLE_API_KEY` in your environment.
3.  **Rust & Node.js**: Required for building the Tauri application.

### Installation

```bash
git clone https://github.com/atakhadiviom/GeminiX.git
cd GeminiX/geminix
npm install
```

### Running in Development

```bash
npm run tauri dev
```

### Building for Production

```bash
npm run tauri build
```

## 🧪 Testing

We've included a smoke test script to verify your environment:

```bash
chmod +x smoke-test.sh
./smoke-test.sh
```

For detailed manual test cases, see [TESTING.md](./TESTING.md).

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Rust + Tauri 2
- **Database**: SQLite (via `tauri-plugin-sql`)
- **CLI Integration**: Managed child process spawning of `gemini chat`

## ⚖️ License

MIT
