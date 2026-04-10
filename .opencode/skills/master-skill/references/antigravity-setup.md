# Google Antigravity — Agent Framework Setup

## Overview
Google Antigravity is an AI agent platform. Setup involves verifying the Antigravity CLI or
SDK is available, initializing a project workspace, and registering the external skills path.

## Installation steps

### 1. Check for Antigravity CLI
```bash
antigravity --version 2>/dev/null || ag --version 2>/dev/null
```
If not found, tell the user:
> "Antigravity CLI not detected. Install it from the Google Antigravity documentation or
> your organization's internal package registry. Once installed, re-run `/master-skill`."

If the CLI is unavailable, skip to the skills loading step — don't block the whole flow.

### 2. Check for project config
Look for `antigravity.json`, `.antigravity/`, or `ag.config.yaml` in the current directory.

- If found: read and confirm the project is already initialized.
- If not found: initialize:
  ```bash
  antigravity init --yes 2>/dev/null || ag init 2>/dev/null
  ```
  If init fails (CLI not available), create a minimal `antigravity.json`:
  ```json
  {
    "project": "my-agent-project",
    "agent": "antigravity",
    "skills_path": "<skills_path>",
    "version": "1.0.0"
  }
  ```

### 3. Register external skills in Antigravity config
Update or create `antigravity.json` to include the skills path:
```json
{
  "skills": {
    "external_path": "<skills_path>",
    "auto_load": true
  }
}
```

### 4. Verify connectivity (optional)
```bash
antigravity status 2>/dev/null || ag status 2>/dev/null
```
Show the output if available; skip silently if CLI is absent.

## Success confirmation
Print: "✓ Antigravity environment configured. Project workspace is ready."
