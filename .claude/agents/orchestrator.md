---
name: orchestrator
description: Coordinates multiple agents for complex multi-step tasks across the full stack
tools: Read, Grep, Glob, Agent(frontend-ui, api-backend, database, test-runner, desktop)
model: sonnet
---

# Subagent Orchestration Guide

This file defines how to coordinate agents for Secret Management Dashboard using Claude Code's Agent tool.

## Agent Registry

| Agent | File | Default Model | Escalation Trigger |
|-------|------|--------------|-------------------|
| frontend-ui | `.claude/agents/frontend-ui.md` | sonnet | Multi-page refactor (4+ pages), new UI subsystem |
| api-backend | `.claude/agents/api-backend.md` | opus | Already opus — downgrade to sonnet for simple CRUD |
| database | `.claude/agents/database.md` | sonnet | Complex migration with data transformation |
| test-runner | `.claude/agents/test-runner.md` | sonnet | New test architecture, security-critical test design |
| desktop | `.claude/agents/desktop.md` | haiku | New Tauri command -> sonnet, architecture change -> opus |

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
- Database migrations and model changes
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
Agent(subagent_type="frontend-ui", prompt="[describe the specific task]")
```
Agent .md dosyasindaki model, tools ve instructions otomatik yuklenir.
Model override gerektiginde: `Agent(subagent_type="api-backend", model="opus", prompt="...")`

### Parallel Agents (Independent Tasks)
Launch multiple Agent calls in a SINGLE message when tasks are independent:
```
Agent(subagent_type="frontend-ui", prompt="[task]")   // runs in parallel
Agent(subagent_type="api-backend", prompt="[task]")    // runs in parallel
Agent(subagent_type="test-runner", prompt="[task]")    // runs in parallel
```

### Sequential Agents (Dependent Tasks)
When one agent's output feeds into another:
```
// Step 1: Schema first
Agent(subagent_type="database", prompt="[create model + migration]")
// Step 2: After completion, API route
Agent(subagent_type="api-backend", prompt="[create endpoint using new model]")
// Step 3: Frontend + Tests in parallel
Agent(subagent_type="frontend-ui", prompt="[create page]")
Agent(subagent_type="test-runner", prompt="[write tests]")
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
