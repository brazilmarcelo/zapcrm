# Claude Code — Agent Framework Setup

## Overview
Claude Code is Anthropic's CLI-based coding agent. Setup here means ensuring the `claude`
CLI is available, the project is initialized with a `CLAUDE.md`, and any existing skills
folder is configured.

## Installation steps

### 1. Verify CLI is available
```bash
claude --version
```
If not found, tell the user: "Claude Code CLI is not installed. Install it with:
`npm install -g @anthropic-ai/claude-code`"

### 2. Check for existing CLAUDE.md
```bash
ls CLAUDE.md 2>/dev/null
```
- If found: read it and summarize its contents for the user ("Your project already has a
  CLAUDE.md with N lines of instructions").
- If not found: offer to create a starter CLAUDE.md:

```markdown
# Project Instructions

This project uses Claude Code with the master-skill orchestrator.

## Agent behavior
- Use external skills loaded by master-skill for specialized tasks
- Prefer task decomposition before implementation
- Follow project conventions in existing files
```

### 3. Configure skills path (if not already in Claude Code settings)
If the user's `skills_path` is not already referenced in CLAUDE.md, append:
```markdown

## Available skills
External skills loaded from: <skills_path>
```

### 4. Verify agent can be invoked
```bash
claude -p "Hello, confirm you are ready." 2>/dev/null | head -5
```
If this fails, note it but don't block the rest of setup.

## Success confirmation
Print: "✓ Claude Code configured. CLAUDE.md is set up and ready."
