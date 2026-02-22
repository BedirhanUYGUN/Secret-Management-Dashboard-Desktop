# Kalan Fazlar — Yapilacaklar

> Tamamlanan: Faz 1 (Login, Guvenlik, Lokalizasyon) + Faz 2 (Kullanici & Proje Yonetimi) + Faz 3 (Import / Export Gelistirmeleri) + Faz 4 (Settings & UX Iyilestirmeleri) + Faz 5 (Test Altyapisi)

---

## Faz 3: Import / Export Gelistirmeleri

- [x] **3.1 Import — Dosya Yukleme**
  - Textarea yanina dosya secme (file input) destegi eklenmesi
  - Surukle-birak (drag & drop) alani
  - `.env` ve `.txt` dosya formatlarini otomatik algilama

- [x] **3.2 Export Modal**
  - Scope secimi (tek ortam / tum ortamlar)
  - Format secimi (`.env`, `JSON`)
  - Tag bazli filtreleme (sadece belirli etiketleri disari aktar)
  - Prod ortami icin onay dialogu
  - Dosya olarak indirme secenegi (pano kopyalama yaninda)

---

## Faz 4: Settings & UX Iyilestirmeleri

- [x] **4.1 Settings Persistence**
  - "Degerleri varsayilan olarak maskele" ayarinin backend'de saklanmasi
  - Kullanici bazli tercih tablosu (veya mevcut user modeline alan eklenmesi)
  - Kaydet butonunun gercekten calismasi

- [x] **4.2 Loading Skeleton / Spinner**
  - Tum sayfalara yukleme animasyonu eklenmesi
  - Mevcut "Yukleniyor..." text'lerinin gorsel spinner ile degistirilmesi

- [x] **4.3 "Updated by" ve "Last used" Bilgileri**
  - Secret detay panelinde "Son guncelleyen" kullanici bilgisinin gosterilmesi
  - "Son kopyalanma / kullanilma" tarihinin gosterilmesi
  - Backend'den bu verilerin frontend'e iletilmesi

- [x] **4.4 Breadcrumb / Sayfa Basligi**
  - Content header'daki ham pathname yerine anlamli breadcrumb gosterimi
  - Ornek: Projeler > Apollo API > DEV

---

## Faz 5: Test Altyapisi

- [x] **5.1 Backend Testleri (pytest)**
  - Auth endpoint testleri (login, refresh, logout)
  - Kullanici CRUD testleri
  - Proje CRUD testleri
  - Secret CRUD testleri
  - Import/export testleri
  - Audit log testleri
  - Yetkilendirme testleri (rol bazli erisim kontrolleri)
  - Test DB fixture'lari ve seed verileri

- [x] **5.2 Frontend Testleri (Vitest + React Testing Library)**
  - LoginPage testi (form submit, hata gosterimi)
  - AuthContext testi (login/logout akisi)
  - UsersPage testi (listeleme, olusturma)
  - ProjectManagePage testi (CRUD islemleri)
  - ProjectsPage testi (secret listeleme, filtreleme)
  - API client mock'lari

---

## Faz 6: Desktop Entegrasyonu (Tauri)

- [x] **6.1 Tauri API Client**
  - Hardcoded mock verilerin kaldirilmasi
  - Web API client'in Tauri uygulamasina entegrasyonu
  - Tauri `invoke` yerine HTTP istekleri veya paylasilmis client kullanimi

- [ ] **6.2 Desktop Auth**
  - Tauri secure storage (keychain/credential store) ile token yonetimi
  - localStorage yerine native guvenli depolama
  - Oturum surekliligi (uygulama kapanip acildiginda)

- [ ] **6.3 Desktop UI Senkronizasyonu**
  - Web uygulamasindaki componentlerin desktop ile paylasimi
  - Tauri-ozel CSS ayarlamalari (pencere kontrolu, baslik cubugu)
  - Desktop-ozel ozellikler (sistem tepsisi, kisayollar)

- [ ] **6.4 Tauri Guvenlik Ayarlari**
  - CSP (Content Security Policy) konfigurasyonu
  - Izin verilen API URL'lerinin tanimlanmasi
  - IPC guvenlik ayarlari

---

## Faz 7: Temizlik & Dagitim

- [ ] **7.1 Eski Node API Temizligi**
  - `apps/api/` klasorunun tamamen kaldirilmasi
  - Root `package.json` workspace referanslarinin guncellenmesi

- [ ] **7.2 CI/CD Pipeline**
  - GitHub Actions konfigurasyonu
  - Backend testleri (pytest) otomatik calistirma
  - Frontend build ve type-check (tsc + vite build)
  - Lint kontrolleri (ruff, eslint)
  - Docker image build & push

- [ ] **7.3 API Dokumantasyonu**
  - FastAPI auto-generated `/docs` disinda kullanim kilavuzu
  - Endpoint aciklamalari ve ornek istek/yanit
  - Kimlik dogrulama akisi dokumantasyonu

- [ ] **7.4 Deployment Guncelleme**
  - `render.yaml` konfigurasyonunun guncellenmesi
  - `Dockerfile` optimizasyonu (multi-stage build)
  - Environment variable kontrol listesi

---

## Notlar

- Tum UI metinleri Turkce olmalidir.
- Commit mesajlari Conventional Commits formatinda ve Turkce yazilmalidir.
- `git push` yapilmaz; sadece commit mesaji onerilir.
- Python backend LSP hatalari (alembic, Pyright tip uyumsuzluklari) mevcut kodda zaten var, calismayi etkilemiyor.
