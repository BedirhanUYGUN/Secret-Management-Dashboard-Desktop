# API Key Organizer - Web MVP Blueprint

## 1) Concise MVP User Flow

### Admin
1. Sign in with company account.
2. Create project and environments (`Local`, `Dev`, `Prod`).
3. Assign users to project with role (`Admin`, `Member`, `Viewer`).
4. Add/import secrets (Key/Token/Endpoint), set tags/notes/provider.
5. Manage environment restrictions (for example, limited prod visibility).
6. Export `.env` or `JSON` as needed.
7. Monitor audit events (create/update/copy/export).

### Developer (Member)
1. Sign in and view only assigned projects.
2. Open project and switch environment tabs.
3. Search/filter secrets and open detail panel.
4. Hold to reveal, copy in preferred format, use snippets.
5. Export assigned project/environment config where permitted.

### Viewer (Read-only)
1. Sign in and view only assigned projects.
2. Browse secrets in simple mode with minimal actions.
3. Copy allowed values/snippets without edit/import/delete access.
4. Clearly see read-only indicators throughout the interface.

## 2) Screen List + Key Components

## A. Auth Screen
- Company login form or SSO entry point
- Role resolution and redirect handler
- Basic error/locked-account states

## B. Main Dashboard (Three-Pane Layout)

Left Sidebar:
- Project list
- Project tags
- Key count badges
- Quick project search

Center Pane:
- Environment tabs (`Local`, `Dev`, `Prod`)
- Secrets table columns:
  - Name
  - Provider
  - Type (`Key`, `Token`, `Endpoint`)
  - Environment
  - Masked Value
  - Updated At
  - Copy
- Toolbar actions (role-aware): `Add Secret`, `Import`, `Export`, filters

Right Detail Panel:
- Secret title + metadata
- Hold-to-reveal masked value
- Copy actions:
  - Value
  - `KEY=value`
  - JSON
  - Python snippet
  - Node snippet
- Notes and tags
- Updated by / updated at

## C. Project Management (Admin)
- Create/edit project
- Assign/remove members
- Role assignment per member
- Env-level access options (especially prod restrictions)

## D. Import Wizard (TXT)
- File upload or paste box
- Parser preview (project headings + KEY=value detection)
- Mapping step (project/environment/provider/type/tag)
- Conflict handling:
  - Skip existing
  - Overwrite latest
  - Create new version
- Import summary report

## E. Export Modal
- Scope selection (project + environment)
- Format selection (`.env`, `JSON`)
- Optional include/exclude tags
- Confirmation warning for sensitive data export

## F. Global Search Screen
- Search input across assigned projects
- Filters:
  - Provider
  - Tag
  - Environment
  - Type
- Result rows deep-link to project + selected secret

## G. Audit Log (Admin)
- Event list with filters (`action`, `project`, `user`, `time`)
- Minimum event types:
  - `secret_created`
  - `secret_updated`
  - `secret_copied`
  - `secret_exported`

## 3) Suggested Navigation Structure + Top-Level Actions

Primary nav:
- `Projects`
- `Search`
- `Import` (Admin only)
- `Audit` (Admin only)
- `Settings` (Admin only)

Project-level actions:
- `Add Secret`
- `Export`
- `Manage Members` (Admin)
- `Access Rules` (Admin)

Secret-level actions (role-aware):
- Everyone with read access: `Copy`, `Open Details`
- Admin/Member with write access: `Edit`, `Retag`, `Archive`
- Admin only: `Delete`, `Bulk Import/Export Controls`

Viewer UX simplification:
- Hide mutating actions entirely when possible
- If shown, keep disabled with clear reason tooltip

## 4) UX Guardrails

Security defaults:
- Mask values by default.
- Reveal is hold-to-reveal only.
- Auto-remask on blur or release.

Clipboard safety:
- Copy confirmation toast with format label.
- Clipboard clear timer (default 30 seconds; configurable).
- Optional warning for copy from `Prod`.

Role clarity:
- Persistent role badge (`Admin`, `Member`, `Viewer`).
- Strong read-only banner in viewer mode.

Prod safeguards:
- Separate access toggle per environment.
- Optional extra confirmation before prod export.

Import safety:
- Mandatory preview before import.
- Explicit conflict strategy step.
- Import dry-run count before final confirmation.

Audit transparency:
- Track and surface copy/export/update events for admins.
- Show “last updated by” and “last used/copied” context where possible.

## 5) Route Map (Web)

- `/login`
- `/projects`
- `/projects/:projectId`
- `/projects/:projectId?env=local|dev|prod`
- `/search`
- `/import` (Admin)
- `/audit` (Admin)
- `/settings` (Admin)

Nested UI state recommendation:
- Query params for table filters (`provider`, `tag`, `type`, `q`)
- Selected secret ID in URL query for deep-linkable detail panel

## 6) Backend Entity Model (MVP)

Core entities:
- `users`
  - `id`, `email`, `display_name`, `status`
- `projects`
  - `id`, `name`, `slug`, `description`
- `project_members`
  - `project_id`, `user_id`, `role` (`admin`, `member`, `viewer`)
- `environments`
  - `id`, `project_id`, `name` (`local`, `dev`, `prod`), `restricted`
- `secrets`
  - `id`, `project_id`, `environment_id`, `name`, `provider`, `type`, `value_encrypted`, `is_masked`, `updated_by`, `updated_at`
- `secret_tags`
  - `secret_id`, `tag`
- `secret_notes`
  - `secret_id`, `content`, `updated_by`, `updated_at`
- `audit_events`
  - `id`, `project_id`, `actor_user_id`, `action`, `target_type`, `target_id`, `metadata`, `created_at`

## 7) Permission Matrix (MVP)

`Admin`:
- Create/update/delete projects: Yes
- Assign members and roles: Yes
- Configure environment restrictions: Yes
- Create/update/delete secrets: Yes
- Copy/reveal/export: Yes
- View audit log: Yes

`Member`:
- View assigned projects: Yes
- Create/update secrets: Yes (project policy dependent)
- Delete secrets: Optional (default No in MVP)
- Copy/reveal/export: Yes where environment access allows
- View audit log: No

`Viewer`:
- View assigned projects: Yes
- Reveal/copy: Yes (policy dependent)
- Export: Optional (default No)
- Create/update/delete/import: No
- View audit log: No

Environment access overlay (applies to all roles):
- User must be project member and pass env restriction checks.
- `Prod` may be denied even when `Dev/Local` are allowed.

## 8) MVP Implementation Notes

- Build web app first; keep API desktop-compatible.
- Keep desktop as optional thin client after web stabilization.
- Prioritize clear role-aware UX over advanced cryptographic features in first release.
