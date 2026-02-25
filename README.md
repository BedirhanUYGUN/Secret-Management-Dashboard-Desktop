# Secret Management Dashboard

Takimlar icin API key, token ve ortam degiskenlerini guvenli yonetmek uzere gelistirilmis web + desktop uygulamasi.

- Web: React + Vite
- Desktop: Tauri (Windows odakli)
- Backend: FastAPI + PostgreSQL
- Guvenlik: AES-256-GCM secret sifreleme, Argon2 password hashing, JWT access/refresh auth

## Hemen Basla

- Web (canli): [Open Web App](https://your-netlify-site.netlify.app)
- Download for Windows: [Download for Windows](https://github.com/BedirhanUYGUN/Secret-Management-Dashboard-Desktop/releases/latest)

Desktop uygulamasi indirildikten sonra kurulum yapip direkt acabilirsiniz. Uygulama canli API'ye baglanarak calisir; kullanicinin lokalinde backend kurmasi gerekmez.

## One Cikan Ozellikler

- Secret degerleri veritabaninda sifreli saklanir (AES-256-GCM)
- RBAC: Admin / Member / Viewer rolleri
- Multi-environment: local / dev / prod
- Project, uye ve ortam erisim yonetimi
- Import / Export (`.env` ve JSON)
- Audit log ve gelismis arama/filtreleme
- Desktop tarafta tokenlar OS keyring uzerinde saklanir

## Desktop Dagitim (Windows)

### Download for Windows linki nasil calisir?

Bu repo `Releases` sayfasindan dagitima uygundur. En pratik link:

- [Download for Windows](https://github.com/BedirhanUYGUN/Secret-Management-Dashboard-Desktop/releases/latest)

Bu link README'de sabit kalir; her yeni surumde kullanici otomatik olarak son release sayfasina gider.

### Kullanici kurunca direkt calisir mi?

Evet, asagidaki 3 ayar dogru oldugu surece direkt calisir:

1. Desktop build API hedefi Render URL'ine bakar
2. Desktop API origin allowlist icinde Render origin vardir
3. Tauri CSP `connect-src` icinde Render domain vardir

Bu ayarlar projede yapildi:

- `apps/desktop/.env.production`
- `apps/web/src/core/api/client.ts`
- `apps/desktop/src-tauri/tauri.conf.json`

Varsayilan production API hedefi:

- `https://api-key-organizer-api.onrender.com`

Eger Render domain'in degisirse sadece bu dosyalardaki domaini guncelleyip desktop release'i yeniden alman yeterli.

## Proje Mimarisi

```
Secret-Management-Dashboard-Desktop/
+-- apps/
|   +-- api_py/      # FastAPI backend
|   +-- web/         # React web frontend
|   \-- desktop/     # Tauri desktop wrapper
+-- docker-compose.yml
+-- Dockerfile
+-- netlify.toml
\-- render.yaml
```

## Kurulum (Lokal)

### Gereksinimler

- Node.js 20+
- Python 3.11+
- Docker Desktop (onerilir)

### Secenek A - Docker ile hizli baslangic

```bash
docker compose up --build
npm install
npm run dev:web
```

- API: `http://localhost:4000`
- Web: `http://localhost:5173`

### Secenek B - Manual calistirma

```bash
npm install
python -m venv apps/api_py/.venv
apps/api_py/.venv/Scripts/activate
pip install -e apps/api_py
python apps/api_py/scripts/migrate.py
python apps/api_py/scripts/run_dev.py
npm run dev:web
```

## Desktop Build (Release)

Windows installer almak icin:

```bash
npm install
npm run tauri -w apps/desktop build
```

Uretilen paketler:

- `apps/desktop/src-tauri/target/release/bundle/`

Bu dosyalari GitHub Releases'a yukleyip README'deki `Download for Windows` linki ile kullanicilara sunabilirsiniz.

## Deployment (Canli)

### Backend - Render

`render.yaml` hazir. Render panelinde su env'leri set et:

- `DATABASE_URL` (Supabase Postgres + `?sslmode=require`)
- `JWT_SECRET_KEY`
- `SECRET_ENCRYPTION_KEY`
- `CORS_ORIGINS=https://<your-netlify-site>.netlify.app`
- `SUPABASE_AUTH_ENABLED=false`

### Frontend - Netlify

`netlify.toml` hazir. Netlify env:

- `VITE_API_BASE_URL=https://api-key-organizer-api.onrender.com`
- `VITE_SUPABASE_AUTH_ENABLED=false`

## Guvenlik Ozeti

- Secret at-rest encryption: AES-256-GCM
- Password hashing: Argon2
- Token modeli: JWT access + refresh rotation
- Refresh tokenlar hashli saklanir
- Login / refresh / register rate limit aktif
- Production'da `/docs` ve `/redoc` kapali
- API security headers aktif (CSP, HSTS, nosniff, frame deny)

## Test ve Dogrulama

Backend:

```bash
cd apps/api_py
python -m pytest
```

Web build:

```bash
npm run -w apps/web build
```

## Altta Ne Olsun? (README icin iyi alt bolum onerisi)

README alt kismina en cok deger katan 3 bolum:

1. `Troubleshooting` (CORS, 401, desktop API baglanti sorunlari)
2. `Roadmap` (auto refresh, error boundary, i18n, auto-update)
3. `FAQ` ("Download link nasil guncellenir?", "Kurunca neden baglanmiyor?")

Istersen bir sonraki adimda bu uc bolumu de full metin olarak ekleyebilirim.

## License

Ozel kullanim.
