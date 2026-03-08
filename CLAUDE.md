# CLAUDE.md - Secret Management Dashboard

## Proje Ozeti
Takimlar icin API key, token ve ortam degiskenlerini guvenli sekilde yonetmek uzere gelistirilmis full-stack monorepo. React + Vite web uygulamasi, FastAPI + PostgreSQL backend ve Tauri masaustu uygulamasindan olusur.

## KRITIK KURALLAR
- Secret degerleri ASLA plaintext loglanmaz veya response'da dondurulmez (sadece `/secrets/{id}/reveal` ucunda)
- `SECRET_ENCRYPTION_KEY` ve `JWT_SECRET_KEY` hardcoded OLMAMALI, her zaman env variable'dan okunmali
- Production'da `/docs` ve `/redoc` endpointleri KAPALI olmali
- AES-256-GCM sifreleme ve Argon2 hashleme standartlarindan sapilmamali
- Refresh token'lar hashli saklanir, plaintext ASLA veritabaninda tutulmaz
- CORS_ORIGINS env variable ile kontrol edilir, wildcard (`*`) YASAK

## Teknoloji ve Mimari

| Katman | Teknoloji |
|--------|-----------|
| Framework (Web) | React 19 + Vite 7 |
| Framework (API) | FastAPI (Python 3.9+) |
| Framework (Desktop) | Tauri 2 (Rust) |
| Dil | TypeScript 5.9, Python, Rust |
| UI | Custom CSS (framework yok) |
| Routing | React Router 7 |
| Veritabani | PostgreSQL 16 |
| ORM | SQLAlchemy + Alembic |
| Test (Web) | Vitest + Testing Library |
| Test (API) | Pytest |
| Auth | JWT access/refresh + opsiyonel Supabase |
| Sifreleme | AES-256-GCM (secret), Argon2 (parola) |
| Deploy | Render (API), Netlify (Web), Docker |

### Istek Akisi (Request Flow)
```
Browser/Tauri -> React App -> client.ts (fetch + JWT header)
                                   |
                                   v
                         FastAPI (routes/*.py)
                                   |
                          +--------+--------+
                          |                 |
                   security.py         crypto.py
                   (JWT verify)     (AES encrypt/decrypt)
                          |                 |
                          +--------+--------+
                                   |
                                   v
                         SQLAlchemy Models -> PostgreSQL
```

## Dizin Yapisi
```
Secret-Management-Dashboard-Desktop/
├── apps/
│   ├── api_py/                    # FastAPI backend
│   │   ├── alembic/               # DB migration'lar
│   │   │   └── versions/          # Migration dosyalari
│   │   ├── app/
│   │   │   ├── api/routes/        # REST endpoint'leri
│   │   │   ├── core/              # crypto.py, security.py
│   │   │   ├── db/                # models, repositories, session
│   │   │   ├── schemas/           # Pydantic schemalar
│   │   │   └── services/          # auth_service, import_parser
│   │   ├── scripts/               # migrate, seed, run_dev
│   │   └── tests/                 # pytest testleri
│   ├── web/                       # React web uygulamasi
│   │   └── src/
│   │       ├── app/               # App.tsx (routing)
│   │       ├── core/              # api client, auth, layout, ui, types, platform
│   │       ├── features/          # Feature-based sayfalar
│   │       │   ├── auth/          # LoginPage, RegisterPage
│   │       │   ├── projects/      # ProjectsPage
│   │       │   ├── search/        # SearchPage
│   │       │   ├── settings/      # SettingsPage
│   │       │   ├── audit/         # AuditPage
│   │       │   ├── import/        # ImportPage
│   │       │   ├── organization/  # OrganizationPage
│   │       │   ├── users/         # UsersPage
│   │       │   ├── project-manage/ # ProjectManagePage
│   │       │   └── not-found/     # NotFoundPage
│   │       └── test/              # Vitest test dosyalari
│   └── desktop/                   # Tauri masaustu uygulamasi
│       └── src-tauri/             # Rust kaynak kodu
├── docker-compose.yml             # PostgreSQL + API servisleri
├── Dockerfile                     # API Docker image
├── netlify.toml                   # Netlify deploy config
└── render.yaml                    # Render deploy config
```

## Onemli Komutlar
```bash
# Gelistirme
npm run dev:web               # React dev server (localhost:5173)
npm run dev:api               # FastAPI dev server (localhost:4000)
docker compose up --build     # Docker ile PostgreSQL + API

# Test
cd apps/web && npx vitest run     # Web testleri
cd apps/api_py && python -m pytest # API testleri

# Build
npm run build:web             # Production web build
npm run typecheck             # TypeScript tip kontrolu

# Veritabani
npm run db:migrate:api        # Alembic migration'lari calistir
npm run db:seed:api           # Test seed verileri yukle
```

## Ortam Degiskenleri

### Backend (`apps/api_py/.env`)
| Degisken | Aciklama |
|----------|----------|
| DATABASE_URL | PostgreSQL baglanti string'i |
| JWT_SECRET_KEY | JWT imzalama anahtari (min 32 karakter) |
| SECRET_ENCRYPTION_KEY | AES-256-GCM sifreleme anahtari (base64) |
| CORS_ORIGINS | Izin verilen origin'ler (virgul ayrimli) |
| SUPABASE_AUTH_ENABLED | Supabase auth aktif mi (true/false) |
| SUPABASE_URL | Supabase proje URL'i |
| SUPABASE_ANON_KEY | Supabase anonim anahtar |

### Web (`apps/web/.env`)
| Degisken | Aciklama |
|----------|----------|
| VITE_API_BASE_URL | Backend API URL'i |
| VITE_ALLOWED_API_ORIGINS | Desktop icin izin verilen API origin'leri |
| VITE_SUPABASE_AUTH_ENABLED | Supabase auth aktif mi |
| VITE_SUPABASE_URL | Supabase proje URL'i |
| VITE_SUPABASE_ANON_KEY | Supabase anonim anahtar |

## Veritabani Modelleri
- **User** — Kullanici (email, password_hash, role, is_active, preferences JSONB)
- **Project** — Proje (name, slug, description, tags, created_by)
- **ProjectMember** — Proje uyeligi (project_id, user_id, role)
- **Environment** — Ortam (project_id, name: local/dev/prod)
- **Secret** — Sifrelenmis secret (environment_id, name, provider, type, key_name, value_encrypted). Unique: (environment_id, key_name)
- **SecretVersion** — Versiyon gecmisi (secret_id, version, encrypted_value, created_by)
- **SecretTag** — Etiketler (secret_id, tag). Unique: (secret_id, tag)
- **SecretNote** — Notlar (secret_id, content, updated_by)
- **RefreshToken** — JWT refresh token (token_hash SHA256, user_id, expires_at, revoked_at)
- **AuditEvent** — Denetim kaydi (action, actor_user_id, project_id, target_type, target_id, metadata JSONB)
- **Enums** — RoleEnum (admin/member/viewer), EnvironmentEnum (local/dev/prod), SecretTypeEnum (key/token/endpoint)

## Kod Standartlari

### Dosya Adlandirma
- Web: PascalCase `.tsx` (component/page), camelCase `.ts` (utility/service)
- API: snake_case `.py`
- Feature dizinleri: kebab-case (`project-manage/`, `not-found/`)

### Pattern'ler
- **Feature-based organization**: Her sayfa `src/features/<feature-name>/` altinda
- **Single API client**: Tum API cagrilari `src/core/api/client.ts` uzerinden
- **AuthContext provider**: Global auth state React Context ile yonetilir
- **Path alias**: `@core/*`, `@features/*` TypeScript path alias'lari

### Genel Kurallar
- UI metinleri Turkce yazilir
- Import siralama: React > third-party > project alias (@core, @features)
- Her route'un RequireAuth ve/veya RequireRole guard'i olmali
- Yeni endpoint eklendiginde hem route hem schema hem client.ts guncellenmelidir

## API Endpoint'leri
| Grup | Endpoint | Yetki |
|------|----------|-------|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` | Public (login), Auth (digerleri) |
| Users | `GET /users`, `POST /users`, `PATCH /users/{id}` | Admin |
| Projects | `GET /projects`, `POST /projects`, `PATCH /projects/{id}`, `DELETE /projects/{id}` | Auth, Admin/Member (mutasyon) |
| Secrets | `GET /projects/{id}/secrets`, `POST /projects/{id}/secrets`, `PATCH /secrets/{id}`, `DELETE /secrets/{id}`, `GET /secrets/{id}/reveal` | Role-based |
| Search | `GET /search` | Auth |
| Import | `POST /imports/preview`, `POST /imports/commit` | Admin/Member |
| Export | `GET /exports/{id}`, `GET /exports/{id}/all` | Admin/Member |
| Audit | `POST /audit/copy`, `GET /audit` | Auth (copy), Admin (list) |

## Rol Tabanlı Erisim
| Islem | Admin | Member | Viewer |
|-------|-------|--------|--------|
| Secret olusturma/guncelleme | ✅ | ✅ | ❌ |
| Secret silme | ✅ | ❌ | ❌ |
| Secret reveal/kopyalama | ✅ | ✅ | ✅ |
| Import/Export | ✅ | ✅ | ❌ |
| Kullanici yonetimi | ✅ | ❌ | ❌ |
| Audit log goruntuleme | ✅ | ❌ | ❌ |
| Proje/Org yonetimi | ✅ | ✅ | ❌ |

## Bagimsiz Moduller
- **Auth modulu**: `core/auth/` + `features/auth/` + `api/routes/users.py` + `services/auth_service.py`
- **Secret yonetimi**: `features/projects/` + `api/routes/secrets.py` + `core/crypto.py`
- **Import/Export**: `features/import/` + `api/routes/imports.py` + `api/routes/exports.py`
- **Audit**: `features/audit/` + `api/routes/audit.py`
- **Organization**: `features/organization/` + `api/routes/project_manage.py`
- **Desktop token storage**: `src-tauri/src/lib.rs` — OS keyring ile guvenli token saklama (keyring crate, service: "com.bedou.secretdashboard.auth")

## Test Altyapisi
- **Web**: Vitest + @testing-library/react + jsdom + user-event
  - Test dosyalari: `apps/web/src/test/`
  - Setup: `apps/web/src/test/setup.ts`
  - Komut: `npx vitest run` veya `npx vitest` (watch)
- **API**: Pytest
  - Test dosyalari: `apps/api_py/tests/`
  - Komut: `python -m pytest`
  - Test kullanicilari: admin@company.local, member@company.local, viewer@company.local
