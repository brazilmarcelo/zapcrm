# SpecKit — Agent Framework Setup

## Overview
SpecKit is a specification-driven AI development framework. It helps teams write structured
specs (PRDs, technical specs, test plans) before implementation, using AI agents to validate
and expand those specs. Setup involves creating the SpecKit project structure and linking skills.

## Installation steps

### 1. Check for existing SpecKit project
```bash
ls speckit.json 2>/dev/null || ls .speckit/ 2>/dev/null
```
If found: read the existing config and confirm settings.

### 2. Create SpecKit project structure
```bash
mkdir -p specs/{prd,technical,tests,decisions}
mkdir -p .speckit
```

Create `speckit.json`:
```json
{
  "version": "1.0",
  "project": "my-agent-project",
  "spec_directory": "specs/",
  "agents": {
    "spec_writer": true,
    "spec_reviewer": true,
    "implementation_planner": true
  },
  "skills_path": "<skills_path>",
  "auto_load_skills": true,
  "validation": {
    "require_spec_before_code": false,
    "warn_on_missing_spec": true
  }
}
```

### 3. Create starter spec templates
Create `specs/prd/template.md`:
```markdown
# Product Requirements Document

## Problem statement
[What problem does this solve?]

## Goals
- Goal 1
- Goal 2

## Non-goals
- Non-goal 1

## User stories
- As a [user], I want [feature] so that [benefit]

## Success metrics
- Metric 1: [target value]
```

Create `specs/technical/template.md`:
```markdown
# Technical Specification

## Architecture overview
[High-level design]

## Components
[List key components]

## Data model
[Key entities and relationships]

## API design
[Key endpoints or interfaces]

## Dependencies
[External services, libraries]
```

### 4. Register skills path
Ensure `speckit.json` has the skills_path set (done in step 2).
Confirm external skills will be available during spec review and implementation planning.

## Success confirmation
Print: "✓ SpecKit configured. Spec templates created in `specs/`. Ready to write specs."
