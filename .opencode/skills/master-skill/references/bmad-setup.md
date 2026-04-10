# BMad — Agent Framework Setup

## Overview
BMad (BMad-METHOD) is an agile AI development framework that uses specialized personas
(analysts, architects, developers, QA agents) to handle different phases of a project.
Setup involves installing the BMad template files and configuring the workspace.

## Installation steps

### 1. Check if BMad is already installed
```bash
ls -la .bmad/ 2>/dev/null || ls -la bmad-core/ 2>/dev/null
```
If found: note the existing installation and skip to step 3.

### 2. Install BMad framework files
Clone or download the BMad template:
```bash
# Option A: via git
git clone https://github.com/bmad-method/bmad-template .bmad-template 2>/dev/null

# Option B: create minimal BMad structure manually
mkdir -p .bmad/{agents,templates,docs}
```

Create the core BMad config `.bmad/bmad.config.json`:
```json
{
  "version": "3.0",
  "project_name": "my-agent-project",
  "agents": ["analyst", "architect", "developer", "qa", "pm"],
  "workflow": "agile",
  "skills_path": "<skills_path>",
  "external_skills_auto_load": true
}
```

### 3. Create the team definition file
Create `.bmad/team.md` if it doesn't exist:
```markdown
# BMad Agent Team

## Active agents
- **Analyst**: Requirements gathering, user story creation
- **Architect**: System design, technical decisions
- **Developer**: Implementation, code review
- **QA**: Testing, quality validation
- **PM**: Project management, sprint planning

## External skills
Loaded from: <skills_path>
```

### 4. Verify BMad personas are accessible
List available agent definitions:
```bash
ls .bmad/agents/ 2>/dev/null
```
If the directory is empty, note that personas will use default BMad definitions.

## Success confirmation
Print: "✓ BMad framework configured. Personas and workflows are ready in `.bmad/`."
