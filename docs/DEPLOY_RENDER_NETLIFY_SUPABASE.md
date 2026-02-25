# Render + Netlify + Supabase Kurulumu

Bu senaryo icin mimari:

- Backend API: Render (Docker service)
- Frontend: Netlify (static Vite build)
- Database + Auth: Supabase

## 1) Supabase Hazirligi

1. Supabase projesi olustur.
2. `Settings -> API` altindan su degerleri al:
   - `Project URL`
   - `anon public key`
3. Postgres baglanti bilgisini al (`DATABASE_URL`, sslmode=require).

## 2) Backend (Render)

Render env degiskenleri:

- `DATABASE_URL=<supabase postgres url>?sslmode=require`
- `JWT_SECRET_KEY=<en az 32 karakter>`
- `SECRET_ENCRYPTION_KEY=<base64 32-byte key>`
- `CORS_ORIGINS=https://<netlify-site>.netlify.app`
- `SUPABASE_AUTH_ENABLED=true`
- `SUPABASE_URL=https://<project-ref>.supabase.co`
- `SUPABASE_ANON_KEY=<supabase anon key>`
- `SUPABASE_SERVICE_ROLE_KEY=<supabase service role key>`
- `SUPABASE_AUTO_PROVISION_USERS=true` (istege bagli)
- `SUPABASE_DEFAULT_ROLE=viewer`

Notlar:

- `SECRET_ENCRYPTION_KEY` otomatik random yerine 32-byte base64 olacak sekilde elle uretilmeli.
- Backend'de migration startup'ta calisir; Supabase DB'de tablo olusumunu bu migration'lar yapar.
- `POST /auth/register` akisinin Supabase kullanicisi olusturabilmesi icin `SUPABASE_SERVICE_ROLE_KEY` zorunludur.

## 3) Frontend (Netlify)

Netlify env degiskenleri:

- `VITE_API_BASE_URL=https://<render-api-domain>`
- `VITE_SUPABASE_AUTH_ENABLED=true`
- `VITE_SUPABASE_URL=https://<project-ref>.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<supabase anon key>`

Build ayarlari:

- Base directory: repo root
- Build command: `npm install && npm run build:web`
- Publish directory: `apps/web/dist`

## 4) Role / Yetki Modeli

Supabase auth kimligi dogrular, uygulama yetkileri backend'deki `users` tablosundaki role ve proje atamalarina gore calisir.

- Kullanici Supabase'de var olup uygulama DB'sinde yoksa:
  - `SUPABASE_AUTO_PROVISION_USERS=true` ise otomatik acilir (varsayilan rol: `SUPABASE_DEFAULT_ROLE`)
  - `false` ise 401 alir

## 5) Ilk Kontrol Listesi

1. Render'da `/health` 200 donuyor mu?
2. Netlify'den login ekrani aciliyor mu?
3. Supabase kullanicisi ile giris basarili mi?
4. `/me` cagrisi backend'de 200 donuyor mu?
5. Secret CRUD ve audit akislari calisiyor mu?
