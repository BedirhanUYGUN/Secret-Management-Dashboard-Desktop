# MVP Release Checklist

Bu dokuman ilk MVP yayinina cikmadan once uygulanacak minimum kontrol listesini verir.

## 1) Ortam Degiskenleri

Backend (`apps/api_py/.env`):

- `DATABASE_URL`
- `JWT_SECRET_KEY` (minimum 32 karakter)
- `SECRET_ENCRYPTION_KEY` (base64, 32 byte decode)
- `CORS_ORIGINS`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `REFRESH_TOKEN_EXPIRE_DAYS`

Web (`apps/web`):

- `VITE_API_BASE_URL`
- (Desktop kullaniliyorsa) `VITE_ALLOWED_API_ORIGINS`

## 2) CI Kapisi

Asagidaki adimlar CI'da yesil olmadan release yapilmaz:

- Backend testleri (`pytest`)
- Web lint (`npm run lint -w apps/web`)
- Web typecheck (`npm run typecheck -w apps/web`)
- Web test (`npm run test -w apps/web`)
- Web build (`npm run build -w apps/web`)

## 3) Deploy Oncesi Hazirlik

- Veritabani yedegi alindi.
- Migration'lar dry-run veya staging'de dogrulandi.
- Render/hosting servisinde env degiskenleri kontrol edildi.
- `health` endpoint'i icin izleme/alarm aktif.

## 4) Deploy Sirasi

1. Backend deploy et.
2. Migration calistir.
3. `GET /health` dogrula.
4. Web deploy et.
5. Temel smoke testleri calistir.

## 5) Smoke Testleri

- Login (admin/member/viewer)
- Project listesi ve role/permission davranisi
- Secret create/update/delete
- Import preview + commit
- Export (`env` ve `json`)
- Audit filtreleme

## 6) Rollback Plani

- Bir onceki stabil image/surume geri don.
- Gerekirse son migration'i geri al.
- Uygulama saglik kontrollerini tekrar dogrula.
- Incident kaydini ac ve kok neden analizi planla.

## 7) Release Sonrasi Izleme

- 24 saat boyunca hata oranlari ve latency takip edilir.
- Auth hata oranlari (401/403) izlenir.
- Import/export ve audit endpoint'lerinde anomali kontrol edilir.
