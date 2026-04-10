# Generic Agent — Framework Setup

## Overview
This setup is used when the user specified a custom or unrecognized agent platform.
The goal is to create a minimal, well-organized project structure that works with any
AI agent environment.

## Installation steps

### 1. Create a project configuration file
Create `.agent-config.json` in the current directory:
```json
{
  "agent": "<agent_name_from_config>",
  "project": "my-agent-project",
  "skills_path": "<skills_path>",
  "configured_at": "<timestamp>",
  "notes": "Configured by master-skill orchestrator"
}
```

### 2. Create a context file for the agent
Create `AGENT.md` if it doesn't exist — many AI agents use a file like this for persistent
instructions (similar to CLAUDE.md for Claude Code):

```markdown
# Agent Instructions

This project is configured with the master-skill orchestrator.

## External skills
External skills are loaded from: <skills_path>

## Working conventions
- Read the skills folder for specialized capabilities before starting tasks
- Decompose complex tasks before implementing
- Document decisions in a `decisions/` folder
```

### 3. Create recommended project structure
```bash
mkdir -p {skills,docs,specs,decisions} 2>/dev/null
```

### 4. Verify environment variables (if applicable)
Check for common API key environment variables:
```bash
env | grep -E "(API_KEY|TOKEN|SECRET)" | sed 's/=.*/=<redacted>/'
```
Show which keys are set (names only, not values) so the user knows what's configured.

## Success confirmation
Print: "✓ Generic agent environment configured. `AGENT.md` and `.agent-config.json` created."
