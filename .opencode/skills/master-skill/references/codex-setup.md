# OpenAI Codex — Agent Framework Setup

## Overview
OpenAI Codex (via the Codex CLI or API) is an AI coding agent. Setup involves verifying
the CLI, creating a project agent config, and registering the skills path.

## Installation steps

### 1. Check for Codex CLI
```bash
codex --version 2>/dev/null
```
If not found:
> "Codex CLI not found. Install it with: `npm install -g @openai/codex`
> or set up API access at https://platform.openai.com"

If CLI unavailable, continue to skills loading without blocking.

### 2. Check for project config
Look for `codex.json`, `.codex/`, or `codex.yaml` in the current directory.

- If found: confirm it's valid and note any existing settings.
- If not found: create `codex.json`:
  ```json
  {
    "model": "codex-latest",
    "project": "my-agent-project",
    "skills_path": "<skills_path>",
    "approval_mode": "auto-edit"
  }
  ```

### 3. Verify API key is available
```bash
echo $OPENAI_API_KEY | head -c 10
```
If empty, warn:
> "No OPENAI_API_KEY found in environment. Codex requires this to run.
> Add it to your shell profile: `export OPENAI_API_KEY=sk-...`"

### 4. Register external skills in Codex config
Ensure the skills path is referenced in `codex.json`:
```json
{
  "context": {
    "skills_path": "<skills_path>",
    "auto_load_skills": true
  }
}
```

## Success confirmation
Print: "✓ Codex environment configured. codex.json is set up and ready."
