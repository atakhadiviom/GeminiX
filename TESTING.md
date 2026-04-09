# GeminiX Testing Guide

Follow these steps to verify the functionality of GeminiX.

## 1. Prerequisites
- [Gemini CLI](https://geminicli.com) installed and authenticated (`gemini chat` works in terminal).
- Rust and Node.js installed.
- `GOOGLE_API_KEY` set in your environment.

## 2. Automated Smoke Test
Run the provided smoke test script:
```bash
chmod +x smoke-test.sh
./smoke-test.sh
```

## 3. Manual Test Cases

### TC-01: Session Initialization
1. Run `npm run tauri dev`.
2. Click **New Session** in the header.
3. Verify the status badge changes to **● Connected**.
4. Type "hello" and verify the AI responds.

### TC-02: File Context Injection (`@`)
1. In the input field, type `@`.
2. Verify a dropdown of files appears.
3. Type part of a filename (e.g., `App`) and verify the list filters.
4. Select a file and verify its path is inserted into the input.

### TC-03: Sidebar File Injection
1. Click on a file in the left sidebar.
2. Verify a message `[Injected file: path/to/file]` appears in the chat.
3. Verify the AI acknowledges the file content.

### TC-04: Shell Command Execution (`!`)
1. Type `!ls` in the input and press Enter.
2. Verify the output of the `ls` command appears in the chat with a `#` tag.

### TC-05: Session History & Resume
1. Send a few messages.
2. Close the application.
3. Reopen the application with `npm run tauri dev`.
4. Verify previous messages are loaded from the database.
5. Click **Resume Latest** and verify you can continue the conversation.

### TC-06: Model Switching
1. Before starting a session, select a different model (e.g., `Gemini 2.0 Pro`) from the dropdown.
2. Click **New Session**.
3. Verify the AI uses the selected model (you can ask it "which model are you using?").

## 4. Feedback
If you encounter any issues, please report them with the following details:
- OS Version
- Gemini CLI Version (`gemini --version`)
- Console errors (if any)
