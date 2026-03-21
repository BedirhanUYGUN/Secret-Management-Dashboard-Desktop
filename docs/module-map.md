# Modul Haritasi (Module Map)

## Amac

Bu belge her ana modulun amacini, sahip oldugu dosyalari, dis bagimliliklerini ve degisiklik yayilim etkilerini tanimlar. Degisiklik oncesinde etki analizi icin basvuru kaynagi olarak kullanilir.

---

## Moduller

### 1. Auth Modulu
- **Amac**: Kullanici kimlik dogrulama ve oturum yonetimi
- **Sahip Klasorler**: `apps/web/src/core/auth/`, `apps/web/src/features/auth/`, `apps/api_py/app/api/routes/users.py`, `apps/api_py/app/services/auth_service.py`
- **Dis Bagimliliklar**: `security.py` (JWT), `crypto.py` (Argon2 proxy), `deps.py`, `domain_repo.py`
- **Paylasilan Dosyalar**: `client.ts`, `types.ts`, `tokenStorage.ts`
- **Impact Alanlari**: Tum korunmus route'lar, MainLayout sidebar, RouteGuards

### 2. Secret Yonetimi Modulu
- **Amac**: Secret CRUD, sifreleme/cozme, versiyon gecmisi
- **Sahip Klasorler**: `apps/web/src/features/projects/`, `apps/api_py/app/api/routes/secrets.py`
- **Dis Bagimliliklar**: `crypto.py` (AES-256-GCM), `deps.py`, `domain_repo.py`, DB modelleri (Secret, SecretVersion, SecretTag, SecretNote)
- **Paylasilan Dosyalar**: `client.ts`, `types.ts`
- **Impact Alanlari**: SearchPage, ImportPage, ExportModal, AuditPage

### 3. Import/Export Modulu
- **Amac**: Toplu secret aktarimi ve disari aktarimi
- **Sahip Klasorler**: `apps/web/src/features/import/`, `apps/api_py/app/api/routes/imports.py`, `apps/api_py/app/api/routes/exports.py`, `apps/api_py/app/services/import_parser.py`
- **Dis Bagimliliklar**: `crypto.py`, `deps.py`, `domain_repo.py`, Secret modeli
- **Paylasilan Dosyalar**: `client.ts`, `types.ts`, `ExportModal.tsx`
- **Impact Alanlari**: ProjectsPage (export butonu), AuditPage (import/export kayitlari)

### 4. Audit Modulu
- **Amac**: Degisiklik denetim kayitlari ve kopyalama takibi
- **Sahip Klasorler**: `apps/web/src/features/audit/`, `apps/api_py/app/api/routes/audit.py`
- **Dis Bagimliliklar**: `deps.py`, `domain_repo.py`, AuditEvent modeli
- **Paylasilan Dosyalar**: `client.ts`, `types.ts`
- **Impact Alanlari**: Tum mutasyon yapan route'lar (audit log yazimi)

### 5. Organization Modulu
- **Amac**: Organizasyon yonetimi, davet sistemi
- **Sahip Klasorler**: `apps/web/src/features/organization/`, `apps/api_py/app/api/routes/project_manage.py`
- **Dis Bagimliliklar**: `deps.py`, `domain_repo.py`, Project/ProjectMember modelleri
- **Paylasilan Dosyalar**: `client.ts`, `types.ts`
- **Impact Alanlari**: ProjectManagePage, MainLayout (proje listesi)

### 6. Desktop Modulu
- **Amac**: Tauri masaustu uygulamasi, OS keyring entegrasyonu
- **Sahip Klasorler**: `apps/desktop/src-tauri/`
- **Dis Bagimliliklar**: `tokenStorage.ts`, `runtime.ts` (frontend-ui alaninda)
- **Paylasilan Dosyalar**: `tokenStorage.ts` (frontend-ui ile paylasim)
- **Impact Alanlari**: Auth akisi (token saklama), API istemcisi (origin dogrulama)

### 7. Kullanici Yonetimi Modulu
- **Amac**: Admin kullanici CRUD, rol ve durum yonetimi
- **Sahip Klasorler**: `apps/web/src/features/users/`, `apps/api_py/app/api/routes/users.py`
- **Dis Bagimliliklar**: `deps.py`, `domain_repo.py`, User modeli
- **Paylasilan Dosyalar**: `client.ts`, `types.ts`
- **Impact Alanlari**: Auth modulu (kullanici durumu), RBAC (rol degisiklikleri)

---

## Degisiklik Yayilim Matrisi (Change Propagation Matrix)

Bir dosya degistiginde kontrol edilmesi gereken diger dosyalar:

| Degisen Dosya | Etkilenen Dosyalar | Etki Seviyesi |
|---------------|-------------------|---------------|
| `types.ts` | TUM feature sayfalar + `client.ts` + TUM web testleri | **YUKSEK** |
| `client.ts` | TUM feature sayfalar + TUM test mock'lari | **YUKSEK** |
| `deps.py` | TUM route dosyalari (`routes/*.py`) | **YUKSEK** |
| `domain_repo.py` | TUM route dosyalari + API testleri | **YUKSEK** |
| `config.py` | `main.py` + `session.py` + `security.py` + `crypto.py` | **KRITIK** |
| DB modelleri (`models/*.py`) | migration + `domain_repo.py` + route dosyalari + API testleri | **KRITIK** |
| `security.py` | `deps.py` + `auth_service.py` + tum korunmus route'lar | **KRITIK** |
| `crypto.py` | `secrets.py` route + `imports.py` + `exports.py` | **KRITIK** |
| `MainLayout.tsx` | Tum sayfalarin navigasyon gorunumu | **ORTA** |
| `App.tsx` | Tum sayfalarin routing erisimi | **ORTA** |
| `AuthContext.tsx` | Tum korunmus sayfalar + `RouteGuards.tsx` | **YUKSEK** |
| `tokenStorage.ts` | `AuthContext.tsx` + `client.ts` + Desktop `lib.rs` | **YUKSEK** |
| `ExportModal.tsx` | `ProjectsPage.tsx` | **DUSUK** |

---

## Cross-Cutting Concerns (Katmanlar Arasi Konular)

### Auth Akisi
```
LoginPage → client.ts → POST /auth/login → auth_service.py → security.py (JWT) → RefreshToken modeli
     ↓
AuthContext → tokenStorage.ts → (localStorage | Tauri keyring)
     ↓
RouteGuards → RequireAuth / RequireRole
     ↓
client.ts → Authorization header → deps.py (get_current_user) → her route
```

### Encryption Akisi
```
Secret olusturma/guncelleme → client.ts → route (secrets.py) → crypto.py (encrypt) → DB (value_encrypted)
Secret reveal → client.ts → route (secrets.py/reveal) → crypto.py (decrypt) → plaintext response
```

### Role-Based Access Control (RBAC)
```
Route seviyesi: deps.py → require_roles(["admin", "member"])
Frontend seviyesi: RouteGuards.tsx → RequireRole
UI seviyesi: MainLayout.tsx → rol bazli sidebar goruntuleme
```

### Audit Logging
```
Mutasyon route'lari → AuditEvent.create() → audit tablosu
Kopyalama → POST /audit/copy → AuditEvent
Listeleme → GET /audit (admin only)
```

---

## Bakim Notlari

- Bu dosya yeni modul, paylasilan dosya veya bagimlilik eklendikce guncellenmelidir
- Documentation agent (`documentation.md`) bu dosyanin bakimindan sorumludur
- Degisiklik Yayilim Matrisi'ni her yeni paylasilan dosya eklendiginde guncelleyin
