# API Key Organizer - MVP Plan (Internal First)

This repository is now focused on a web-first internal tool for company teams.

Context:
- Team size: 8 users (6 developers, 2 non-technical)
- Product type: productivity app, not enterprise vault
- Primary interface: web app
- Optional interface: thin desktop client using the same backend API

## MVP Goals

- Organize API keys, tokens, and endpoints by project and environment.
- Restrict access so users only see projects they are assigned to.
- Support roles: `Admin`, `Member`, `Viewer`.
- Enable fast copy/snippet workflows and simple exports (`.env`, `JSON`).
- Keep a basic audit trail for critical actions.

## In Scope

- Company auth + role-based access
- Project assignment and environment-level restrictions (including prod restrictions)
- Secrets table + detail panel with masked-by-default behavior
- TXT import with preview
- Export per project/environment
- Global search with provider/tag filters
- Admin audit log

## Out of Scope (MVP)

- Enterprise-grade vault controls (HSM, advanced policy engines, break-glass, etc.)
- Fine-grained approval workflows
- SSO variants beyond initial company auth choice
- Complex compliance reporting

## Deliverables

Detailed UX and architecture planning is documented in:

- `docs/MVP_WEB_BLUEPRINT.md`

That document includes:
- Role-based user flows
- Screen list and component breakdown
- Navigation and top-level actions
- UX guardrails
- Route map and backend entity/permission matrix
