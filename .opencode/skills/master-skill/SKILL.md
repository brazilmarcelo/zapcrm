---
name: master-skill
description: >
  Orchestrates AI agent development environments on demand. ONLY activate when the user
  explicitly runs the `/master-skill` command — never trigger automatically. When invoked,
  this skill: (1) detects if it's a first run and guides setup (which AI agent platform to
  use, where external skills are stored), (2) saves config to `.master-skill-config.json`,
  (3) installs and configures the chosen agent framework (BMad, SpecKit, or Antigravity Kit),
  and (4) loads all external skills from the configured folder into the active session context.
  Use this skill for any request containing `/master-skill`, "configure my agent environment",
  "set up my dev agent", "load my skills folder", or "install agent framework".
---

# Master Skill — AI Agent Environment Orchestrator

You are the **master-skill** orchestrator. Your job is to set up a complete AI agent development
environment in a single command. This means: reading the user's saved configuration, installing
their chosen agent framework, and loading their external skills — all without them having to
repeat themselves session after session.

---

## Step 0 — Detect context and load config

Before doing anything else, check for a config file called `.master-skill-config.json` in the
**current working directory** (where the user is running the command from):

```bash
cat .master-skill-config.json 2>/dev/null
```

**If the file exists:** read it silently and proceed directly to Step 2 (Framework Installation).
Do not ask the user questions they already answered. Just say something like:
> "Config found. Setting up your environment with **[agent]** and loading skills from `[path]`…"

**If the file does NOT exist:** this is a first run — proceed to Step 1 (Initial Setup).

---

## Step 1 — First-run initial setup (only if no config exists)

Guide the user through two questions. Ask them one at a time to keep it clear:

### 1a. Which AI agent platform do you want to use?

Present these options (and note that others can be typed manually):

| # | Agent Platform | Description |
|---|---------------|-------------|
| 1 | **Claude Code** | Anthropic's CLI coding agent |
| 2 | **Antigravity** | Google Antigravity agent environment |
| 3 | **Codex** | OpenAI's Codex agent |
| 4 | **Other** | Enter a custom agent name |

Wait for the user to choose before continuing.

### 1b. Where are your external skills stored?

Ask:
> "What is the full path to the folder where your external skills are stored?
> For example: `/Users/you/dev/my-skills` or `C:\Users\you\skills`"

Wait for their answer. If the path they give doesn't exist yet, ask if they want to create it
or use a different path.

### Save the config

Once you have both answers, save them to `.master-skill-config.json` in the current directory:

```json
{
  "agent": "Claude Code",
  "skills_path": "/Users/you/dev/my-skills",
  "configured_at": "2026-03-31T00:00:00Z",
  "version": 1
}
```

Confirm to the user:
> "Config saved to `.master-skill-config.json`. This setup won't be asked again — run
> `/master-skill --reset` any time you want to change it."

Then continue to Step 2.

---

## Step 2 — Install and configure the agent framework

Based on the `agent` field in the config, read the corresponding reference file and follow
its installation instructions:

| Agent value | Reference file to read |
|-------------|------------------------|
| `Claude Code` | `references/claude-code-setup.md` |
| `Antigravity` | `references/antigravity-setup.md` |
| `Codex` | `references/codex-setup.md` |
| `BMad` | `references/bmad-setup.md` |
| `SpecKit` | `references/speckit-setup.md` |
| Other / unknown | Read `references/generic-agent-setup.md` |

The reference file contains the exact steps for scaffolding and configuring that framework.
Follow them completely. If something goes wrong (missing dependency, wrong directory, etc.),
explain the issue clearly and offer a fix — don't just fail silently.

After setup completes, print a short confirmation:
> "✓ [Framework name] configured and ready."

---

## Step 3 — Load external skills into the active context

Read the `skills_path` from config. Scan the folder for skill files:

```bash
ls -la "<skills_path>" 2>/dev/null
```

Accepted skill file formats:
- `*.md` — Markdown skill files (read directly)
- `SKILL.md` inside subdirectories — structured skill folders
- `*.json` — JSON-defined skill manifests
- `*.yaml` / `*.yml` — YAML skill definitions

For **each skill found**:
1. Read the file content
2. Extract the skill name (from frontmatter `name:` field, filename, or directory name)
3. Load it into the session as an available skill
4. Note any skills that fail to load (malformed, missing required fields, etc.)

After scanning, print a summary:

```
✓ Skills loaded from /Users/you/dev/my-skills:

  • skill-one     — Brief description or "(no description)"
  • skill-two     — Brief description or "(no description)"
  • skill-three   — Brief description or "(no description)"

  3 skills ready. 0 failed to load.
```

If the folder is empty or doesn't exist, say so clearly and offer to create it or choose
a different path.

---

## Step 4 — Final status report

After completing all steps, print a clean environment summary:

```
╔══════════════════════════════════════════╗
║         master-skill — Environment Ready ║
╚══════════════════════════════════════════╝

  Agent platform : Claude Code
  Framework      : ✓ Configured
  External skills: ✓ 3 loaded from ~/dev/my-skills

  Type /help to see available skills and commands.
  Type /master-skill --reset to reconfigure.
```

---

## Reset flag — `/master-skill --reset`

If the user runs `/master-skill --reset` (or says "reset my master-skill config"):
1. Delete or overwrite `.master-skill-config.json`
2. Run the first-time setup again from Step 1

---

## Error handling principles

- If a framework install step fails, show the error, explain what likely went wrong (missing
  tool, wrong OS, permissions), and suggest a fix. Don't abort the whole setup — continue
  loading external skills even if the framework step had issues.
- If the skills path doesn't exist, tell the user and ask: create it, choose a different path,
  or skip this step?
- If a skill file is malformed, skip it and log it in the summary — don't crash the whole load.
- Always be transparent: tell the user exactly what ran, what succeeded, and what didn't.

---

## Important behavior rules

- **Never activate automatically.** This skill only runs when `/master-skill` is explicitly
  called. Do not trigger it for any other reason.
- **Never repeat setup questions** if a valid config already exists, unless the user passes
  `--reset`.
- **Be fast and decisive** — the whole point of this skill is that one command sets everything
  up. Don't ask for unnecessary confirmations mid-flow.
- **Respect the user's existing files** — never overwrite project files, `.env`, or other
  configs unless explicitly asked.
