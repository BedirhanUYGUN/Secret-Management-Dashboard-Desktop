# Subagent Orchestration Guide

This file defines how to coordinate agents for Secret Management Dashboard using Claude Code's Task tool.

## Agent Registry

| Agent | File | Default Model | Escalation Trigger |
|-------|------|--------------|-------------------|
| frontend-ui | `.claude/agents/frontend-ui.md` | sonnet | Multi-page refactor (4+ pages), routing redesign |
| api-backend | `.claude/agents/api-backend.md` | opus | Already opus — downgrade to sonnet for simple CRUD |
| database | `.claude/agents/database.md` | sonnet | Complex migration with data transformation |
| test-runner | `.claude/agents/test-runner.md` | sonnet | New test architecture design |
| desktop | `.claude/agents/desktop.md` | haiku | Tauri command/plugin changes -> sonnet |

## Model Selection Guide

### Use `opus` when:
- Modifying security/crypto modules (crypto.py, security.py)
- Designing a new subsystem or architectural component
- Refactoring that touches 4+ files simultaneously
- Debugging complex cross-module auth/encryption issues
- Making decisions that affect multiple agents' domains
- Implementing security-critical features

### Use `sonnet` (default) when:
- Adding a new feature page following existing patterns
- Adding a new API endpoint (route + schema + client)
- Writing or updating tests
- Standard CRUD operations
- Bug fixes with known root cause
- Most day-to-day development work

### Use `haiku` when:
- Updating documentation or comments
- Simple renames or formatting changes
- Adding log lines or minor config changes
- CSS-only tweaks
- Quick file reads and analysis tasks
- Desktop config updates

## How to Launch a Subagent

### Single Agent Task
```
Task(subagent_type="general-purpose", model="sonnet", prompt="
You are the [Agent Name] agent for Secret Management Dashboard.
Read .claude/agents/[agent-file].md for your full instructions.
Task: [describe the specific task]
")
```

### Parallel Agents (Independent Tasks)
Launch multiple Task calls in a SINGLE message when tasks are independent:
```
// Message with multiple Task calls:
Task(model="sonnet", prompt="[Frontend UI task]")   // runs in parallel
Task(model="opus", prompt="[API Backend task]")      // runs in parallel
Task(model="sonnet", prompt="[Test Runner task]")    // runs in parallel
```

### Sequential Agents (Dependent Tasks)
When one agent's output feeds into another:
```
// Step 1: Create API endpoint first
Task(model="sonnet", prompt="[API Backend: create endpoint]")
// Step 2: After completion, create frontend page
Task(model="sonnet", prompt="[Frontend UI: create page using new endpoint]")
// Step 3: Write tests for both
Task(model="sonnet", prompt="[Test Runner: write tests]")
```

## Workflow Templates

### New Feature (Full-Stack)
1. **database** (sonnet) — Create model + migration (if new table needed)
2. **api-backend** (sonnet) + **frontend-ui** (sonnet) — Implement endpoint + page in parallel
3. **test-runner** (sonnet) — Write API + frontend tests

### Bug Fix
1. **api-backend** (opus) or **frontend-ui** (sonnet) — Investigate and fix root cause
2. **test-runner** (sonnet) — Add regression test

### Security Update
1. **api-backend** (opus) — Implement security change (crypto, auth, headers)
2. **test-runner** (sonnet) — Write security-focused tests
3. **frontend-ui** (sonnet) — Update frontend if auth flow changed

### New API Endpoint Only
1. **api-backend** (sonnet) — Create route + schema
2. **frontend-ui** (sonnet) + **test-runner** (sonnet) — Add client function + write tests in parallel

### UI-Only Change
1. **frontend-ui** (sonnet) — Implement UI change
2. **test-runner** (sonnet) — Update component tests

## Anti-Patterns (AVOID)
- Do NOT launch opus for simple tasks — it's slower and more expensive
- Do NOT run agents sequentially when they can run in parallel
- Do NOT skip reading the agent's .md file before starting work
- Do NOT assign a task to an agent outside its domain — check Files You Own
- Do NOT modify security modules (crypto.py, security.py) without opus model
- Do NOT push to remote without explicit user permission
