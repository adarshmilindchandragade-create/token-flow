# How to Run TokenFlow AI in VS Code (F5 Guide)

This is a complete step-by-step guide: from opening the folder to having a working extension running in the Extension Development Host.

---

## Step 1 — Open the Project

1. Launch **VS Code**
2. Go to **File → Open Folder…**
3. Select `C:\Users\Asus\Downloads\project 6 token flow`
4. VS Code opens the project. You'll see the file explorer on the left.

---

## Step 2 — Install Dependencies (first time only)

Open the **Terminal** inside VS Code:

- Press `` Ctrl+` `` (backtick) — or go to **Terminal → New Terminal**

Run:

```bash
npm install
```

Wait for it to finish (installs `@anthropic-ai/sdk`, `js-tiktoken`, etc.).

---

## Step 3 — Build the Extension

```bash
npm run build
```

Expected output:
```
  dist\extension.js      6.1mb
  dist\extension.js.map  6.9mb

Done in 170ms
[TokenFlow] Build complete.
```

If you see errors — run `npm run type-check` to find them.

---

## Step 4 — Press F5

1. Press **F5** on your keyboard
   - *Alternatively:* go to **Run → Start Debugging** in the menu bar

2. VS Code will:
   - Ask which debug configuration to use (if it's your first time) → select **"Run Extension"**
   - Compile the TypeScript
   - Open a **new VS Code window** — this is the **Extension Development Host**

3. The new window's title bar will show:
   ```
   [Extension Development Host] — VS Code
   ```

> ⚠️ You now have **two VS Code windows open**:
> - **Window 1 (original):** your source code — use this to make changes
> - **Window 2 (Extension Development Host):** where the extension runs — use this to test it

---

## Step 5 — Open a Workspace in the Extension Host

The extension needs a workspace folder to scan for files. In the **Extension Development Host** window:

1. **File → Open Folder…**
2. Open any project folder — you can open the TokenFlow project itself:
   `C:\Users\Asus\Downloads\project 6 token flow`
3. If VS Code asks to trust the folder → click **"Yes, I trust the authors"**

---

## Step 6 — Configure a Provider

In the **Extension Development Host** window:

### Option A — OpenRouter (Free, Recommended)

1. Press `Ctrl+Shift+P` to open the Command Palette
2. Type `TokenFlow: Select Provider` → press Enter
3. Choose **OpenRouter** from the list
4. Press `Ctrl+Shift+P` again
5. Type `TokenFlow: Set API Key` → press Enter
6. Paste your OpenRouter key: `sk-or-...`
   - Get a free key at [openrouter.ai](https://openrouter.ai) (no credit card needed)
7. Press Enter

You should see: `✅ TokenFlow: API key saved for openrouter.`

### Option B — Ollama (No Internet, No Key)

If you have Ollama installed:

```bash
# Check if it's running (in any terminal)
curl http://localhost:11434/api/version
```

If it responds — just set the provider:

1. `Ctrl+Shift+P` → `TokenFlow: Select Provider` → **Ollama**
2. No key needed — it's ready immediately

### Option C — Anthropic

1. `Ctrl+Shift+P` → `TokenFlow: Select Provider` → **Anthropic**
2. `Ctrl+Shift+P` → `TokenFlow: Set API Key` → paste your `sk-ant-...` key

---

## Step 7 — Use the Extension

All commands are in the **Command Palette** (`Ctrl+Shift+P`):

### Send a Prompt
1. Open any `.ts` or `.js` file in the Extension Host window
2. `Ctrl+Shift+P` → `TokenFlow: Send Optimized Prompt`
3. Type your question (e.g., `"What does this function do?"`)
4. Press Enter

What happens:
```
1. TokenFlow reads your active file + git diff + imports
2. Runs the 4-stage optimizer (typically 60–70% token reduction)
3. Sends the optimized context + your question to the AI
4. Shows the response in a Markdown panel on the right
5. Shows a notification: "⚡ TokenFlow: 2,340 tokens saved (68%) · Cost: <$0.001"
```

### See Token Usage
- `Ctrl+Shift+P` → `TokenFlow: Show Token Monitor`
- A panel opens showing input tokens, output tokens, session cost, savings

### See What Gets Sent to the Model
- `Ctrl+Shift+P` → `TokenFlow: Show Before/After Comparison`
- Opens a Markdown document showing raw vs optimized context

### Switch Provider On-The-Fly
- `Ctrl+Shift+P` → `TokenFlow: Select Provider`
- Pick a different provider → status bar updates immediately (no restart needed)

### Switch Model
- `Ctrl+Shift+P` → `TokenFlow: Select Model`
- Shows all models for the active provider (free models listed first)

---

## Step 8 — Check the Output Logs

In the **Extension Development Host** window:
1. Go to **View → Output** (or press `Ctrl+Shift+U`)
2. In the dropdown at the top right of the Output panel → select **"TokenFlow AI"**

You'll see structured logs:
```
[TokenFlow] TokenFlow AI v1.1 activating...
[TokenFlow] Provider initialized: openrouter / google/gemma-3-12b-it:free
[TokenFlow] → openrouter/google/gemma-3-12b-it:free  (prompt: 4,230 chars)
[TokenFlow] ✓ openrouter/google/gemma-3-12b-it:free  843ms  in:1058 out:312 <$0.001
```

---

## Step 9 — Make a Change and Reload

When you change the source code in **Window 1** (original):

1. Save the file (`Ctrl+S`)
2. Press **F5** again (or click the green Restart button in the debug toolbar)
   - *Or* in the original window: press `Ctrl+Shift+F5` to restart
3. The Extension Development Host reloads automatically

> **Tip:** Keep `npm run build:watch` running in Window 1's terminal so TypeScript compiles automatically on save:
> ```bash
> npm run build:watch
> ```

---

## Status Bar

After configuring a provider, the status bar at the bottom of the Extension Host window shows:

```
⚡ openrouter/google/gemma-3-12b-it:free  0 tokens  $0.00
```

Click on it to open the Token Monitor panel.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| F5 opens a browser instead of VS Code | Make sure you're pressing F5 **inside VS Code**, not a browser |
| "No debug configuration" prompt | Select **"Run Extension"** from the dropdown |
| Extension not activating | Check the Debug Console in Window 1 for errors |
| "No provider configured" error | Run `TokenFlow: Select Provider` in the Extension Host window |
| Ollama connection refused | Run `ollama serve` in a separate terminal |
| OpenRouter 401 error | Check your API key with `TokenFlow: Set API Key` |
| Extension Host crashes | Check `npm run type-check` — likely a TypeScript error |
| Status bar not updating | Make sure you opened a folder in the Extension Host window (Step 5) |

---

## Quick Reference

```
Window 1 (source):                Window 2 (Extension Host):
  Ctrl+`  → terminal                Ctrl+Shift+P  → command palette
  F5      → launch/restart          TokenFlow: Select Provider
  npm run build:watch               TokenFlow: Set API Key
  npm test                          TokenFlow: Send Optimized Prompt
  npm run type-check                TokenFlow: Show Token Monitor
                                    TokenFlow: Show Before/After
                                    View → Output → TokenFlow AI
```
