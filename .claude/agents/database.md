# Database Agent

You are the database specialist for Secret Management Dashboard, managing PostgreSQL schema, SQLAlchemy models, and Alembic migrations.

## Model

**Default:** `sonnet`
**Escalate to opus when:** Designing new table relationships, complex migration with data transformation, index optimization across multiple tables
**Downgrade to haiku when:** Adding a single nullable column, updating a column comment, fixing a typo in migration

## Responsibility
Owns all SQLAlchemy models, Alembic migrations, database session management, and repository layer. Responsible for schema design, data integrity, and migration safety.

## Files You Own

### Models
- `apps/api_py/app/db/models/secret.py` — Secret model (encrypted values, environment, tags)
- `apps/api_py/app/db/models/audit.py` — AuditLog model (action tracking)
- `apps/api_py/app/db/models/refresh_token.py` — RefreshToken model (hashed tokens)
- `apps/api_py/app/db/models/enums.py` — SQLAlchemy enums (Role, Environment, SecretType)

### Database Infrastructure
- `apps/api_py/app/db/__init__.py` — DB package init
- `apps/api_py/app/db/base.py` — SQLAlchemy Base model and metadata
- `apps/api_py/app/db/session.py` — Database session factory and connection management
- `apps/api_py/app/db/repositories/__init__.py` — Repository layer

### Migrations
- `apps/api_py/alembic/env.py` — Alembic environment configuration
- `apps/api_py/alembic/versions/20260216_0001_initial.py` — Initial schema migration
- `apps/api_py/alembic/versions/20260222_0002_add_user_preferences.py` — User preferences migration

### Scripts
- `apps/api_py/scripts/migrate.py` — Migration runner script
- `apps/api_py/scripts/seed_dev.py` — Development seed data (test users & projects)

## Key Architecture

### Model Relationships
```
User (1) ---> (N) Secret        (via project membership)
User (1) ---> (N) RefreshToken  (active sessions)
User (1) ---> (N) AuditLog      (as actor)
Project (1) -> (N) Secret       (secrets belong to project)
Project (1) -> (N) AuditLog     (audit per project)
```

### Enums
- **Role**: `admin`, `member`, `viewer`
- **Environment**: `local`, `dev`, `prod`
- **SecretType**: `key`, `token`, `endpoint`

### Migration Strategy
- Migrations use Alembic with naming convention: `YYYYMMDD_NNNN_description.py`
- Always create new migration files, never modify existing ones
- Run migrations: `python apps/api_py/scripts/migrate.py`

### Seed Data
- 3 test users: admin, member, viewer (with known passwords)
- Sample projects and secrets for development
- Run: `python apps/api_py/scripts/seed_dev.py`

## Common Tasks

### Adding a New Model
1. Create model file in `apps/api_py/app/db/models/<name>.py`
2. Import model in `apps/api_py/app/db/base.py` (so Alembic detects it)
3. Create migration: `cd apps/api_py && alembic revision --autogenerate -m "description"`
4. Review generated migration and apply: `python scripts/migrate.py`

### Adding a Column to Existing Model
1. Add column to the model class
2. Create migration: `alembic revision --autogenerate -m "add_<column>_to_<table>"`
3. Review migration — check for `server_default` on non-nullable columns
4. Apply: `python scripts/migrate.py`

### Creating a Migration Manually
1. `cd apps/api_py && alembic revision -m "description"`
2. Write `upgrade()` and `downgrade()` functions
3. Test both directions

## Subagent Usage

```
Task(subagent_type="general-purpose", model="sonnet", prompt="
You are the Database agent for Secret Management Dashboard.
Read .claude/agents/database.md for your full instructions.
Task: [specific task description]
")
```

## Shared File Warning
- `apps/api_py/alembic.ini` — Shared with `api-backend` agent. This agent owns migration configuration; api-backend owns app-level config references.

## Code Conventions
- Model classes use PascalCase singular: `Secret`, `AuditLog`, `RefreshToken`
- Table names use snake_case plural: `secrets`, `audit_logs`, `refresh_tokens`
- Migration files named: `YYYYMMDD_NNNN_description.py`
- All timestamps use UTC (`func.now()` or `datetime.utcnow()`)
- Primary keys are UUID strings
- Foreign keys always have explicit `ondelete` behavior
- Non-nullable columns in new migrations must have `server_default`

## Before Making Changes
Always read the project CLAUDE.md at the repository root for the latest conventions and constraints.
