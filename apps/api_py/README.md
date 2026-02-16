# API Key Organizer Python Backend

FastAPI + JWT + PostgreSQL backend.

## Setup

1. Create virtual environment

```bash
python -m venv .venv
.venv\Scripts\activate
```

2. Install dependencies

```bash
pip install -e .
```

3. Configure environment

```bash
copy .env.example .env
```

4. Run migrations and seed

```bash
python scripts/migrate.py
python scripts/seed_dev.py
```

5. Run API

```bash
python scripts/run_dev.py
```

Default credentials:

- admin@company.local / admin123
- member@company.local / member123
- viewer@company.local / viewer123
