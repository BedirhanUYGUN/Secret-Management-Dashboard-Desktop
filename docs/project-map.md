# Proje Haritasi (Project Map)

## Sistemin Ust Duzey Amaci

Secret Management Dashboard, takimlar icin API key, token ve ortam degiskenlerini guvenli sekilde yonetmeye yonelik bir full-stack uygulamadir. AES-256-GCM sifreleme, rol tabanli erisim kontrolu (RBAC) ve denetim kaydi (audit log) ile kurumsal duzeyde guvenlik saglar.

---

## Katman Haritasi

### Web Katmani (React + Vite)
- **12 Feature Sayfa**: LoginPage, RegisterPage, ProjectsPage, ProjectManagePage, SearchPage, SettingsPage, AuditPage, ImportPage, OrganizationPage, UsersPage, NotFoundPage, DashboardPage
- **13+ UI Component**: Modal, ExportModal, AppUiContext, ToastViewport, Spinner, AuthContext, RouteGuards, MainLayout, App, tokenStorage, runtime, client, types

### API Katmani (FastAPI)
- **12 Route Dosyasi**: secrets, projects, audit, imports, exports, search, users, auth (login/refresh/logout/me), project_manage, service_tokens, dashboard
- **9 Schema Dosyasi**: secrets, users, audit, imports, common, projects, organizations, service_tokens, dashboard
- **4 Service**: auth_service, import_parser + ek servisler
- **4 Core Modul**: crypto.py, security.py, config.py, deps.py

### Veritabani Katmani (PostgreSQL + SQLAlchemy)
- **8+ Model**: User, Project, ProjectMember, Environment, Secret, SecretVersion, SecretTag, SecretNote, RefreshToken, AuditEvent
- **2 Repository**: domain_repo + base

### Desktop Katmani (Tauri 2 / Rust)
- **2 Rust Dosyasi**: lib.rs (keyring komutlari), main.rs (giris noktasi)

---

## Kritik Paylasilan Dosyalar

Bu dosyalar birden fazla modul tarafindan kullanilir. Degisiklik yapildiginda tum bagimli dosyalar kontrol edilmelidir.

| Dosya | Konum | Etki Alani | Aciklama |
|-------|-------|------------|----------|
| `client.ts` | `apps/web/src/core/api/client.ts` | TUM frontend-backend iletisimi | Tek merkezi API istemcisi, JWT enjeksiyonu |
| `types.ts` | `apps/web/src/core/types.ts` | TUM TypeScript tipleri | User, Secret, Project, Role vb. arayuzler |
| `deps.py` | `apps/api_py/app/core/deps.py` | TUM FastAPI auth/session bagimliliklari | get_current_user, get_db, require_roles |
| `domain_repo.py` | `apps/api_py/app/db/repositories/domain_repo.py` | TUM is mantigi sorgulari | Tum route dosyalari bu repository'yi kullanir |
| `config.py` | `apps/api_py/app/core/config.py` | TUM env variable konfigurasyonu | DATABASE_URL, JWT_SECRET_KEY, ENCRYPTION_KEY vb. |
| `MainLayout.tsx` | `apps/web/src/core/layout/MainLayout.tsx` | TUM navigasyon/sidebar mantigi | Breadcrumb, klavye kisayollari, rol bazli gorunum |
| `App.tsx` | `apps/web/src/app/App.tsx` | TUM routing tanimlari | RequireAuth/RequireRole guard'lari |

---

## Route - Feature Eslestirme Tablosu

| Frontend Route | Feature Page | Backend Route | Schema | Model |
|---------------|--------------|---------------|--------|-------|
| `/login` | LoginPage | `POST /auth/login` | users.py | User |
| `/register` | RegisterPage | `POST /auth/register` | users.py | User, Organization |
| `/projects/:id` | ProjectsPage | `GET/POST /projects/{id}/secrets` | secrets.py | Secret, Environment |
| `/project-manage/:id` | ProjectManagePage | `PATCH /projects/{id}` | projects.py | Project, ProjectMember |
| `/search` | SearchPage | `GET /search` | secrets.py | Secret |
| `/settings` | SettingsPage | `PATCH /users/{id}` | users.py | User |
| `/audit` | AuditPage | `GET /audit` | audit.py | AuditEvent |
| `/import` | ImportPage | `POST /imports/preview,commit` | imports.py | Secret |
| `/organization` | OrganizationPage | `GET/PATCH /organization` | organizations.py | Organization |
| `/users` | UsersPage | `GET/POST/PATCH /users` | users.py | User |
| `/dashboard` | DashboardPage | `GET /dashboard/stats` | dashboard.py | - (aggregate) |

---

## Dosya Sayilari (Yaklasik)

| Kategori | Sayi |
|----------|------|
| Python dosyalari (.py) | ~51 |
| TypeScript dosyalari (.ts/.tsx) | ~51 |
| API Route dosyalari | 12 |
| Feature sayfalar | 12 |
| Veritabani modelleri | 8+ |
| UI componentleri | 13+ |
| Web test dosyalari | 14 |
| API test dosyalari | 4 |
| Alembic migration dosyalari | 2+ |
| Agent tanimlari | 7 |

---

## Bakim Notlari

- Bu dosya yeni feature, route veya model eklendikce guncellenmelidir
- Documentation agent (`documentation.md`) bu dosyanin bakimindan sorumludur
- Guncelleme tetikleme: Yeni feature sayfa, yeni API route, yeni DB model, yeni paylasilan dosya
