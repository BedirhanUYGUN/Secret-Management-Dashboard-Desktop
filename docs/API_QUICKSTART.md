# API Quickstart

Bu belge MVP icin temel API kullanimini ozetler.

## 1) Authentication Akisi

### Register

`POST /auth/register`

```json
{
  "firstName": "Ali",
  "lastName": "Yilmaz",
  "email": "ali@company.local",
  "password": "StrongPass1!",
  "purpose": "organization",
  "organizationMode": "create",
  "organizationName": "Nova Labs"
}
```

Not:

- `organizationMode=join` icin `inviteCode` zorunludur.
- Join ile gelen kullanici varsayilan `viewer` olarak eklenir.

### Login

`POST /auth/login`

```json
{
  "email": "admin@company.local",
  "password": "admin123"
}
```

Basarili cevap:

- `accessToken`
- `refreshToken`
- `tokenType`
- `expiresAt`

### Refresh

`POST /auth/refresh`

```json
{
  "refreshToken": "..."
}
```

### Logout

`POST /auth/logout`

```json
{
  "refreshToken": "..."
}
```

### Me

`GET /me`

Header:

`Authorization: Bearer <accessToken>`

## 2) Proje ve Secret Akislari

- `GET /projects`
- `GET /projects/{project_id}/secrets`
- `POST /projects/{project_id}/secrets`
- `PATCH /secrets/{secret_id}`
- `DELETE /secrets/{secret_id}`
- `GET /secrets/{secret_id}/reveal`

## 3) Import / Export

- `POST /imports/preview`
- `POST /imports/commit`
  - `conflictStrategy`: `skip` veya `overwrite`
- `GET /exports/{project_id}?env=dev&format=env|json`
- `GET /exports/{project_id}/all?format=env|json`

## 4) Audit

- `POST /audit/copy`
- `GET /audit`

Olay tipleri:

- `secret_created`
- `secret_updated`
- `secret_deleted`
- `secret_copied`
- `secret_exported`

## 5) Lokal Calistirma

Backend:

```bash
pip install -e .[dev]
python scripts/migrate.py
python scripts/seed_dev.py
python scripts/run_dev.py
```

Web:

```bash
npm install
npm run dev:web
```
