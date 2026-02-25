# Render + Netlify + Supabase Kurulumu

Bu kurulumda onerilen mimari:

- Backend API: Render (Docker service)
- Frontend: Netlify (static Vite build)
- Database: Supabase Postgres
- Auth: Uygulamanin native JWT auth sistemi (`SUPABASE_AUTH_ENABLED=false`)

## 1) Supabase Hazirligi

1. Supabase projesi olustur.
2. `Settings -> Database` altindan Postgres baglanti bilgisini al.
3. `DATABASE_URL` icin `?sslmode=require` eklemeyi unutma.

## 2) Backend (Render)

`render.yaml` dosyasi kullaniliyor. Render panelinde asagidaki env degerlerini gir:

- `DATABASE_URL=<supabase postgres url>?sslmode=require`
- `JWT_SECRET_KEY=<en az 32 karakter>`
- `SECRET_ENCRYPTION_KEY=<base64 32-byte key>`
- `CORS_ORIGINS=https://<netlify-site>.netlify.app`
- `APP_ENV=production`
- `SUPABASE_AUTH_ENABLED=false`

Notlar:

- `SECRET_ENCRYPTION_KEY` icin ornek uretim:
  - `python -c "import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"`
- Backend startup'ta migration calistirir.
- Production modunda `/docs` ve `/redoc` kapatilir.

## 3) Frontend (Netlify)

Netlify env degiskenleri:

- `VITE_API_BASE_URL=https://<render-api-domain>`
- `VITE_SUPABASE_AUTH_ENABLED=false`

Build ayarlari (`netlify.toml`):

- Build command: `npm ci && npm run -w apps/web build`
- Publish directory: `apps/web/dist`
- Redirect: `/* -> /index.html (200)`

## 4) Auth ve Kayit Akisi

- Tum kayitlar sadece uygulamanin `POST /auth/register` endpoint'i uzerinden acilir.
- Login `POST /auth/login` endpoint'inden yapilir.
- Refresh token rotation aktif ve tokenlar DB'de hashlenmis saklanir.

## 5) Ilk Kontrol Listesi

1. Render'da `/health` 200 donuyor mu?
2. Netlify'de login/register sayfalari aciliyor mu?
3. Yeni kullanici sadece uygulama register formu ile olusuyor mu?
4. `/me` cagrisi backend'de 200 donuyor mu?
5. Secret CRUD, export ve audit akislari calisiyor mu?
