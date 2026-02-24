# Secret Management Dashboard

Takim icindeki API anahtarlarini, token'lari ve endpoint'leri guvenli sekilde yoneten, rol tabanli erisim kontrolune sahip bir masaustu + web uygulamasi.

## Ozellikler

- **Sifrelenmis Secret Depolama** — Tum secret degerleri backend'de AES ile sifrelenir, varsayilan olarak maskeli gosterilir
- **Rol Tabanli Erisim Kontrolu (RBAC)** — Admin, Member ve Viewer rolleri ile farkli yetki seviyeleri
- **Coklu Ortam Destegi** — Local, Dev ve Prod ortamlarina ayri erisim kontrolu
- **Masaustu Uygulamasi (Tauri)** — Windows, macOS ve Linux'ta native calisir; token'lar isletim sistemi guvenli deposunda (keychain/credential store) saklanir
- **Web Uygulamasi** — Ayni kod tabanini paylasan tarayici versiyonu
- **Import / Export** — `.env` ve JSON formatinda toplu icerik aktarimi, surukle-birak destegi
- **Denetim Kayitlari (Audit Log)** — Secret olusturma, guncelleme, kopyalama ve export islemleri kaydedilir
- **Arama** — Tum projelerdeki secret'larda saglayici, etiket, ortam ve tip bazli filtreleme
- **Pano Guvenligi** — Kopyalanan degerler ayarlanabilir sure sonunda otomatik temizlenir

## Teknoloji Yigini

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 19, TypeScript, React Router 7, Vite 7 |
| Masaustu | Tauri 2 (Rust), OS Keyring entegrasyonu |
| Backend | Python FastAPI, SQLAlchemy 2, Alembic |
| Veritabani | PostgreSQL |
| Guvenlik | JWT (access + refresh token), Argon2 sifre hashleme, AES sifreleme |
| Test | Vitest + React Testing Library (frontend), pytest (backend) |
| Deployment | Docker, Render.com |

## Proje Yapisi

```
Secret-Management-Dashboard-Desktop/
├── apps/
│   ├── api_py/          # Python FastAPI backend
│   │   ├── app/         # Uygulama kodu (routes, models, services, schemas)
│   │   ├── alembic/     # Veritabani migration dosyalari
│   │   ├── scripts/     # Dev betikleri (run, migrate, seed)
│   │   └── tests/       # pytest test suite
│   ├── desktop/         # Tauri masaustu uygulamasi
│   │   ├── src/         # Desktop giris noktasi (titlebar, CSS)
│   │   └── src-tauri/   # Rust backend (keyring token yonetimi)
│   └── web/             # React web uygulamasi
│       └── src/
│           ├── api/         # API istemcisi (fetch wrapper)
│           ├── auth/        # Kimlik dogrulama context & route guard
│           ├── layout/      # Ana layout (sidebar + icerik)
│           ├── pages/       # Sayfa bileenleri
│           ├── platform/    # Tauri/Browser ortam soyutlamasi
│           ├── ui/          # Paylailan UI bilesenleri
│           └── test/        # Frontend testleri
├── Dockerfile               # Python API Docker imaji
└── render.yaml              # Render.com deployment tanimi
```

## Kurulum ve Calistirma

### Gereksinimler

- **Node.js** 18+ ve **npm**
- **Python** 3.11+
- **PostgreSQL** 14+
- **Rust** (sadece masaustu derlemesi icin)

### 1. Depoyu Klonla

```bash
git clone <repo-url>
cd Secret-Management-Dashboard-Desktop
npm install
```

### 2. Backend Kurulumu (Python API)

```bash
cd apps/api_py

# Sanal ortam olustur ve aktif et
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Bagimliklar
pip install -e .

# Ortam degiskenleri
cp .env.example .env
```

`.env` dosyasini duzenle:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/api_key_organizer
JWT_SECRET_KEY=en-az-32-karakter-uretim-icin-degistir
SECRET_ENCRYPTION_KEY=   # Asagidaki komutla uret
CORS_ORIGINS=http://localhost:5173,http://localhost:1420
```

Sifreleme anahtari uretmek icin:

```bash
python -c "import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
```

Veritabanini hazirla:

```bash
python scripts/migrate.py     # Migration'lari calistir
python scripts/seed_dev.py    # Test verilerini yukle
```

API'yi baslat:

```bash
python scripts/run_dev.py     # http://localhost:4000
```

### 3a. Web Uygulamasini Calistirma

Proje kokunde:

```bash
npm run dev:web               # http://localhost:5173
```

### 3b. Masaustu Uygulamasini Calistirma (Tauri)

```bash
cd apps/desktop
npm run tauri dev
```

> Tauri ilk calistirmada Rust bagimliklarini derler, bu birka dakika surebilir.

### Varsayilan Test Hesaplari

| Rol | E-posta | Sifre |
|-----|---------|-------|
| Admin | admin@company.local | admin123 |
| Member | member@company.local | member123 |
| Viewer | viewer@company.local | viewer123 |

## Kullanim

### Giris ve Navigasyon

1. Uygulama acildiginda giris ekrani karsilar
2. Test hesaplarindan biriyle giris yap
3. Sol panelde atanmis projeler listelenir
4. Bir proje sectiginde ortam tablari (Local / Dev / Prod) goruntulenir
5. Secret'lara tiklayarak detay panelini ac

### Secret Yonetimi (Admin & Member)

- **Olusturma**: "Yeni Secret" butonu ile ad, saglayici, tip, deger, etiketler ve notlar gir
- **Gorme**: Deger varsayilan maskeli; "Goster" ile gecici olarak ac
- **Kopyalama**: Deger panoya kopyalanir, ayarlanabilir sure sonunda otomatik silinir
- **Guncelleme / Silme**: Detay panelinden duzenle veya kaldir

### Arama

- Ust menuden "Arama" sayfasina git
- Ad, saglayici veya anahtar ile ara
- Ortam, tip, saglayici ve etiket filtrelerini kullan
- Sonuca tikla, ilgili projeye dogrudan git

### Import (Admin)

- `.env` veya `.txt` dosyasi yukle ya da surukle-birak
- Icerik onizlemesi goruntulenir
- Hedef proje, ortam ve catisma stratejisi (atla / uzerine yaz) sec
- Toplu olarak ice aktar

### Export (Admin)

- Proje sayfasindan "Disari Aktar" butonuna tikla
- Tek ortam veya tum ortamlari sec
- `.env` ya da `JSON` formati sec
- Panoya kopyala veya dosya olarak indir
- Prod ortami icin ek onay istenir

### Kullanici Yonetimi (Admin)

- Yeni kullanici olustur (email, ad, rol, sifre)
- Var olan kullanicilari duzenle veya devre disi birak
- Proje bazli uye atamasi ve ortam erisim kontrolu

### Denetim Kayitlari (Admin)

- Islem tipi, proje, kullanici e-postasi ve tarih araligi ile filtrele
- Kim, ne zaman, hangi secret uzerinde ne yapti goruntulenir

## API Dokumanatasyonu

Backend calisirken FastAPI otomatik dokumantasyonuna eris:

- **Swagger UI**: http://localhost:4000/docs
- **ReDoc**: http://localhost:4000/redoc

### Temel Endpointler

| Yontem | Yol | Aciklama |
|--------|-----|----------|
| POST | `/auth/login` | Giris yap, token al |
| POST | `/auth/refresh` | Token yenile |
| GET | `/me` | Mevcut kullanici profili |
| GET | `/projects` | Atanmis projeler |
| GET | `/projects/{id}/secrets` | Projedeki secret'lar |
| POST | `/projects/{id}/secrets` | Yeni secret olustur |
| GET | `/secrets/{id}/reveal` | Secret degerini goster |
| GET | `/search?q=...` | Genel arama |
| POST | `/imports/preview` | Import onizleme |
| POST | `/imports/commit` | Import uygula |
| GET | `/exports/{id}` | Secret'lari disari aktar |
| GET | `/audit` | Denetim kayitlari |
| GET | `/users` | Kullanici listesi (admin) |
| POST | `/projects/manage` | Proje olustur (admin) |

## Testler

### Backend Testleri

```bash
cd apps/api_py
pytest
```

Kapsam: Auth, kullanici CRUD, proje CRUD, secret CRUD, import/export, audit, yetkilendirme.

### Frontend Testleri

```bash
cd apps/web
npx vitest run
```

Kapsam: LoginPage, AuthContext, UsersPage, ProjectManagePage, ProjectsPage, API client mock'lari.

## Deployment

### Docker (Backend)

```bash
docker build -t secret-dashboard-api .
docker run -p 4000:4000 --env-file apps/api_py/.env secret-dashboard-api
```

### Render.com

Proje `render.yaml` ile hazir yapilandirilmis:
- **API**: Docker servisi olarak deploy edilir, PostgreSQL veritabani otomatik olusturulur
- **Web**: Statik site olarak deploy edilir (`apps/web/dist`)

### Masaustu Dagitimi

```bash
cd apps/desktop
npm run tauri build
```

Platform-spesifik installer `src-tauri/target/release/bundle/` altinda olusur.

## MVP Degerlendirmesi

### Hazir Olanlar

- [x] Kimlik dogrulama (JWT access + refresh token)
- [x] Rol tabanli erisim kontrolu (Admin / Member / Viewer)
- [x] Secret CRUD islemleri (sifrelenmis depolama)
- [x] Coklu ortam destegi (Local / Dev / Prod)
- [x] Proje ve kullanici yonetimi
- [x] Import / Export (`.env`, `JSON`)
- [x] Arama ve filtreleme
- [x] Denetim kayitlari
- [x] Masaustu uygulamasi (Tauri + OS keyring)
- [x] Web uygulamasi
- [x] Backend + frontend test altyapisi
- [x] Docker ve Render.com deployment yapilandirmasi

### Bilinen Sinirlamalar

- **Token yenileme otomatik degil** — Access token suresi dolunca kullanici tekrar giris yapmali (varsayilan 30 dk). `refreshSession()` fonksiyonu mevcut ama otomatik tetiklenmiyor.
- **Arama debounce yok** — Her tus vurusu API cagrisi tetikler; yogun kullanmida gereksiz yuk olusabilir.
- **Hata siniri (Error Boundary) yok** — Beklenmeyen bir React hatasi uygulamanin tamamen beyaz ekran gostermesine neden olabilir.
- **Dil sadece Turkce** — i18n altyapisi yok, tum metinler hardcoded Turkce.
- **Frontend form dogrulama sinirli** — Cogu dogrulama backend tarafinda, bos form gonderimleri genel hata mesaji dondurur.

### Sonuc

Uygulama **MVP olarak kullanilabilir** durumdadir. Tum temel islevler (giris, secret yonetimi, RBAC, import/export, audit, arama) calismaktadir. Yukardaki sinirlamalar kullanici deneyimini etkiler ancak temel islevi engellemez. 30 dakikalik token suresi normal kullanim icin yeterlidir.

## Lisans

Bu proje ozel kullanim icindir.
