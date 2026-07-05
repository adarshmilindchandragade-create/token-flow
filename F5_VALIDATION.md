# F5 Validation Guide — TokenFlow AI v1.1

> Step-by-step protocol for validating the extension in the Extension Development Host.
> Run this after every major change before committing.

---

## Prerequisites

```bash
npm run build          # Must succeed with no errors
npm test               # Must show 84/84 passing
```

---

## Launch Extension Development Host

1. Open `c:\Users\Asus\Downloads\project 6 token flow` in VS Code
2. Press **F5** (or **Run → Start Debugging**)
3. A new VS Code window opens with `[Extension Development Host]` in the title bar
4. Open any TypeScript project in that window (or use this repo itself)

---

## Test Matrix

### ✅ Test 1 — Provider Selection Quick-Pick

**Command Palette → `TokenFlow: Select Provider`**

Expected UI:
```
🟢 OpenRouter    Free models available · Best for development   [Ready]
🔴 Anthropic     Claude Sonnet/Haiku/Opus · Production quality  [Needs API key]
🌐 Ollama        Local inference · No API key needed            [No key needed]
⏳ OpenAI        Coming in v2
⏳ Gemini        Coming in v2
```

Pass criteria:
- [ ] All 5 providers listed
- [ ] OpenRouter shows 🟢 if key is set, 🔴 if not
- [ ] Ollama always shows 🌐
- [ ] Selecting a provider updates `tokenflow.provider` in settings
- [ ] Status bar updates immediately (no restart)

---

### ✅ Test 2 — Model Selection Quick-Pick

**Command Palette → `TokenFlow: Select Model`**

Expected for OpenRouter:
```
🆓 Gemma 3 12B (default)     32,768 ctx
🆓 Qwen 3 8B                 32,768 ctx · thinking
🆓 DeepSeek R1               65,536 ctx
🆓 Llama 3.1 8B Instruct    131,072 ctx
🆓 Mistral 7B Instruct       32,768 ctx
   claude/claude-3-5-...     [paid models below free]
```

Pass criteria:
- [ ] Free models (🆓) appear first
- [ ] Context window shown in detail
- [ ] Capabilities (thinking, vision) shown
- [ ] Selecting updates `tokenflow.model` setting

---

### ✅ Test 3 — OpenRouter (Zero-Cost)

**Requires:** Free OpenRouter key from openrouter.ai

```
Command: TokenFlow: Select Provider → OpenRouter
Command: TokenFlow: Set API Key → sk-or-...
Command: TokenFlow: Send Optimized Prompt → "What does this extension do?"
```

Pass criteria:
- [ ] Status bar shows: `$(circuit-board) openrouter/google/gemma-3-12b-it:free`
- [ ] Progress notification appears during build + optimize
- [ ] Response opens in a Markdown panel to the right
- [ ] Notification shows: `⚡ TokenFlow: X tokens saved (Y%) · Cost: <$0.001`
- [ ] Token Monitor panel shows usage after prompt
- [ ] Cost displayed as `$0.00` or `<$0.001`

---

### ✅ Test 4 — Ollama (Offline)

**Requires:** Ollama running locally with `qwen2.5` model

```bash
# Verify Ollama is running
curl http://localhost:11434/api/version
# → {"version":"..."}
```

```
Settings: "tokenflow.provider": "ollama"
Command: TokenFlow: Send Optimized Prompt → "Explain this file in one sentence"
```

Pass criteria:
- [ ] Status bar shows: `$(circuit-board) ollama/qwen2.5:latest`
- [ ] Response arrives (may be slower than cloud providers)
- [ ] Cost shows `$0.00` (local = free)
- [ ] No API key prompt appeared

---

### ✅ Test 5 — Anthropic (Production)

**Requires:** Anthropic API key with available credits

```
Command: TokenFlow: Select Provider → Anthropic
Command: TokenFlow: Set API Key → sk-ant-...
Command: TokenFlow: Send Optimized Prompt → "Review this code for any issues"
```

Pass criteria:
- [ ] Status bar shows: `$(circuit-board) anthropic/claude-3-5-sonnet-20241022`
- [ ] Real token counts (input/output) shown in monitor
- [ ] Cost shows actual dollar amount (e.g., `$0.0043`)
- [ ] Streaming response (text appears progressively)

---

### ✅ Test 6 — OpenAI Stub (Expected Failure)

```
Settings: "tokenflow.provider": "openai"
Command: TokenFlow: Set API Key → sk-...
Command: TokenFlow: Send Optimized Prompt → "test"
```

Pass criteria:
- [ ] Error message: `"TokenFlow: OpenAI provider is not yet implemented..."`
- [ ] Status bar shows error state
- [ ] No crash (graceful error handling)

---

### ✅ Test 7 — Hot-Switch (No Restart)

```
1. Start on OpenRouter provider, send a prompt
2. Command Palette → TokenFlow: Select Provider → Anthropic
3. Send another prompt immediately
```

Pass criteria:
- [ ] Status bar updates to Anthropic after selection
- [ ] Second prompt uses Anthropic (no VS Code restart needed)
- [ ] Session stats accumulate across both providers

---

### ✅ Test 8 — Token Monitor Panel

**Command Palette → `TokenFlow: Show Token Monitor`**

Pass criteria:
- [ ] Panel opens
- [ ] After sending a prompt: input/output tokens visible
- [ ] Session cost accumulates correctly
- [ ] Token savings shown after optimization

---

### ✅ Test 9 — Before/After Comparison

**Open a TypeScript file → `TokenFlow: Show Before/After Comparison`**

Pass criteria:
- [ ] Markdown document opens with:
  - `## Summary` block
  - `## Context Breakdown` block
  - `## Optimized Context` block
- [ ] Token counts present and > 0
- [ ] Savings percentage > 0 (typically 60–70%)

---

### ✅ Test 10 — Session Reset

```
1. Send at least one prompt
2. Command Palette → TokenFlow: Reset Session Stats
```

Pass criteria:
- [ ] Information message: `"TokenFlow: Session stats reset."`
- [ ] Status bar clears usage counters
- [ ] Token Monitor panel resets to zero

---

## Output Channel Verification

Open **Output → TokenFlow AI** to verify structured logging:

```
[TokenFlow] TokenFlow AI v1.1 activating...
[TokenFlow] Provider initialized: openrouter / google/gemma-3-12b-it:free
[TokenFlow] → openrouter/google/gemma-3-12b-it:free  (prompt: 4,230 chars)
[TokenFlow] ✓ openrouter/google/gemma-3-12b-it:free  843ms  in:1058 out:312 <$0.001
```

Pass criteria:
- [ ] `→` lines appear before each request
- [ ] `✓` lines appear after each successful response
- [ ] Latency, token counts, and cost appear in each `✓` line

---

## Known Limitations (v1.1)

| Limitation | Workaround | Target |
|---|---|---|
| OpenAI / Gemini are stubs | Use OpenRouter for those models | v2 |
| Stream interruption not cancellable | Wait for response to complete | v2 |
| Context limited to open workspace | Works on projects loaded in VS Code | by design |
| Ollama on non-default port | Set `tokenflow.ollamaBaseUrl` | v1.1 |

---

## Signing Off

After completing all 10 tests:

```bash
# Commit
git add -A
git commit -m "feat(v1.1): multi-provider architecture — OpenRouter/Anthropic/Ollama live, 84 tests, 70% token savings measured"
git tag v1.1.0
git push && git push --tags
```
