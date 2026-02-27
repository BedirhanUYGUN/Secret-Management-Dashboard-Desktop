# SırIKI

SırIKI, takımlar için API key, token ve ortam değişkenlerini güvenli şekilde yönetmek üzere geliştirilmiş web + masaüstü uygulamasıdır.

- Web: React + Vite
- Masaüstü: Tauri (Windows odaklı)
- Backend: FastAPI + PostgreSQL
- Güvenlik: AES-256-GCM şifreleme, Argon2 parola hashleme, JWT access/refresh akışı

## Hızlı Erişim

- Web (canlı): [SırIKI Web](https://secret-management.netlify.app)
- API sağlık kontrolü: [Render Health](https://secret-management-dashboard-desktop.onrender.com)
- Windows indirme: [SirIKI-Desktop.exe](https://github.com/BedirhanUYGUN/Secret-Management-Dashboard-Desktop/raw/main/downloads/windows/SirIKI-Desktop.exe)

SırIKI masaüstü uygulamasını kurduktan sonra doğrudan açabilirsiniz. Uygulama canlı API’ye bağlanır; kullanıcı tarafında ayrıca backend kurulumu gerekmez.

## Öne Çıkan Özellikler

- Secret değerleri veritabanında şifreli saklanır (AES-256-GCM)
- Rol tabanlı yetkilendirme (Admin / Member / Viewer)
- Çoklu ortam desteği (local / dev / prod)
- Proje, üye ve ortam erişim yönetimi
- `.env` ve JSON import / export
- Audit log, arama ve filtreleme
- Masaüstünde token saklama için OS keyring kullanımı

## Proje Yapısı

```text
Secret-Management-Dashboard-Desktop/
├─ apps/
│  ├─ api_py/       # FastAPI backend
│  ├─ web/          # React web uygulaması
│  └─ desktop/      # Tauri masaüstü uygulaması
├─ docker-compose.yml
├─ Dockerfile
├─ netlify.toml
└─ render.yaml
```

## Lokal Kurulum

### Gereksinimler

- Node.js 20+
- Python 3.11+
- Docker Desktop (önerilir)

### Seçenek A — Docker ile hızlı başlangıç

```bash
docker compose up --build
npm install
npm run dev:web
```

- API: `http://localhost:4000`
- Web: `http://localhost:5173`

### Seçenek B — Manuel çalıştırma

```bash
npm install
python -m venv apps/api_py/.venv
apps/api_py/.venv/Scripts/activate
pip install -e apps/api_py
python apps/api_py/scripts/migrate.py
python apps/api_py/scripts/run_dev.py
npm run dev:web
```

## Ortam Değişkenleri

### Backend (`apps/api_py/.env`)

`apps/api_py/.env.example` dosyasını kopyalayın ve değerleri doldurun.

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/api_key_organizer
JWT_SECRET_KEY=en-az-32-karakter-guclu-rastgele-deger
SECRET_ENCRYPTION_KEY=  # Aşağıdaki komutla üretin
CORS_ORIGINS=http://localhost:5173,http://localhost:1420

# Supabase auth (opsiyonel)
SUPABASE_AUTH_ENABLED=false
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_AUTO_PROVISION_USERS=false
SUPABASE_DEFAULT_ROLE=viewer
```

`SECRET_ENCRYPTION_KEY` üretmek için:

```bash
python -c "import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
```

`JWT_SECRET_KEY` üretmek için:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

### Web (`apps/web/.env`)

`apps/web/.env.example` dosyasını kopyalayın:

```env
VITE_API_BASE_URL=http://localhost:4000
VITE_ALLOWED_API_ORIGINS=http://localhost:4000,https://localhost:4000

# Supabase auth (opsiyonel)
VITE_SUPABASE_AUTH_ENABLED=false
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Veritabanı ve API

```bash
python apps/api_py/scripts/migrate.py
python apps/api_py/scripts/seed_dev.py
python apps/api_py/scripts/run_dev.py
```

Varsayılan test kullanıcıları:

- `admin@company.local / admin123`
- `member@company.local / member123`
- `viewer@company.local / viewer123`

## Masaüstü Build (Release)

Windows installer üretmek için:

```bash
npm install
npm run tauri -w apps/desktop build
```

Üretilen paketler:

- `apps/desktop/src-tauri/target/release/bundle/`

README’deki `Windows indirme` bağlantısı SırIKI için depodaki güncel `.exe` dosyasına gider.

## Canlı Ortam (Deployment)

### Backend — Render

`render.yaml` hazır. Render ortam değişkenleri:

- `DATABASE_URL` (Supabase Postgres + `?sslmode=require`)
- `JWT_SECRET_KEY`
- `SECRET_ENCRYPTION_KEY`
- `CORS_ORIGINS=https://secret-management.netlify.app`
- `SUPABASE_AUTH_ENABLED` (`true` / `false`)
- `SUPABASE_URL` ve `SUPABASE_ANON_KEY` (Supabase auth açıksa)

### Frontend — Netlify

`netlify.toml` hazır. Netlify ortam değişkenleri:

- `VITE_API_BASE_URL=https://secret-management-dashboard-desktop.onrender.com`
- `VITE_SUPABASE_AUTH_ENABLED` (`true` / `false`)
- `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` (Supabase auth açıksa)

## Güvenlik Özeti

- Secret veriler at-rest AES-256-GCM ile şifrelenir
- Parolalar Argon2 ile hashlenir
- JWT access + refresh token akışı kullanılır
- Refresh token’lar hashli olarak saklanır
- Login / refresh / register uçlarında rate limit aktiftir
- Production’da `/docs` ve `/redoc` kapalıdır
- API security header’ları aktiftir (CSP, HSTS, nosniff, frame deny)

## Test ve Doğrulama

Backend testleri:

```bash
cd apps/api_py
python -m pytest
```

Web build:

```bash
npm run -w apps/web build
```

## Lisans

MIT - detaylar için `LICENSE` dosyasına bakın.
