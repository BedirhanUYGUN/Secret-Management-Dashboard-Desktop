# Degisiklik Etki Kontrol Listesi (Change Impact Checklist)

## Amac

Bu kontrol listesi, herhangi bir degisiklik yapilmadan once ve sonra uygulanacak adimlari tanimlar. Amac: degisikliklerin diger modullere etkisini onceden tespit etmek ve tutarsizliklari onlemektir.

---

## 1. Kapsam Belirleme

- [ ] Degisiklik hangi katmanda? (Web / API / DB / Desktop)
- [ ] Kac dosya etkileniyor?
- [ ] Paylasilan dosya var mi? (`client.ts`, `types.ts`, `deps.py`, `domain_repo.py`, `config.py`, `MainLayout.tsx`, `App.tsx`)
- [ ] `docs/module-map.md` Degisiklik Yayilim Matrisi kontrol edildi mi?

## 2. Etki Siniflandirmasi

| Seviye | Kriter | Aksiyon |
|--------|--------|---------|
| **DUSUK** | 1-3 dosya, tek modul, paylasilan dosya yok | Dogrudan ilerle |
| **ORTA** | 4-8 dosya, paylasilan dosya degisiyor | `module-map.md` kontrol et, ilgili testleri calistir |
| **YUKSEK** | 9+ dosya, katmanlar arasi degisiklik | Orchestrator koordinasyonu, tum etkilenen testler |
| **KRITIK** | Guvenlik modulleri, DB schema degisikligi | Opus model, ADR yaz, tam test suite calistir |

## 3. Agent Atamasi Kontrolu

- [ ] Degisiklik dogru agent'in sorumluluk alaninda mi?
- [ ] Paylasilan dosya degisiyorsa ilgili agent'lar bilgilendirildi mi?
- [ ] KRITIK seviye icin opus model secildi mi?
- [ ] Katmanlar arasi degisiklik icin orchestrator kullaniliyor mu?

## 4. Guvenlik Kontrolu

- [ ] Secret degerleri plaintext loglanmiyor mu?
- [ ] Hardcoded key veya secret eklenmedi mi?
- [ ] CORS ayarlari wildcard (`*`) icermiyor mu?
- [ ] RBAC (rol tabanli erisim) dogru uygulanmis mi?
- [ ] Yeni endpoint'te `Depends(require_roles(...))` guard var mi?
- [ ] Sifreleme standartlari (AES-256-GCM, Argon2) korunuyor mu?

## 5. Test Kontrolu

- [ ] Etkilenen tum testler calistirildi mi?
- [ ] Korunmus endpoint'ler icin 3 rol (admin/member/viewer) test edildi mi?
- [ ] Hata senaryolari (404, 403, 409, 422) test edildi mi?
- [ ] Regression testi eklendi mi (bug fix icin)?
- [ ] Paylasilan dosya degistiyse tum bagimli testler calistirildi mi?

## 6. Dokumantasyon Kontrolu

- [ ] CLAUDE.md guncellenmesi gerekiyor mu? (Yeni pattern, endpoint, model)
- [ ] `docs/project-map.md` guncellenmesi gerekiyor mu? (Yeni feature, route, model)
- [ ] `docs/module-map.md` guncellenmesi gerekiyor mu? (Yeni bagimlilik, paylasilan dosya)
- [ ] Agent dosyalari guncellenmesi gerekiyor mu? (Yeni sorumluluk alani)
- [ ] ADR yazilmasi gerekiyor mu? (Asagidaki kriterlere bak)

## 7. ADR Tetikleme Kriterleri

Asagidaki durumlardan herhangi biri gecerliyse yeni bir ADR yazilmalidir:

- [ ] Yeni veritabani modeli veya tablosu eklendi
- [ ] Yeni UI pattern'i veya paylasilan component olusturuldu
- [ ] Auth veya crypto mekanizmasi degistirildi
- [ ] Yeni dis bagimlitik (npm paketi, Python paketi, Rust crate) eklendi
- [ ] 4+ dosyanin ayni anda degistiginden mimari karar gerektiren degisiklik
- [ ] Mevcut bir pattern'den sapildi (ve bu sapma kasitli)

---

## Hizli Referans: Degisiklik Turune Gore Kontrol

### Yeni Feature Sayfasi Ekleme
1. Feature dizini olustur (`features/<name>/`)
2. Route ekle (`App.tsx`) + Guard
3. Nav link ekle (`MainLayout.tsx`) + rol kontrolu
4. API cagrisi ekle (`client.ts`)
5. Tipler ekle (`types.ts`)
6. Test yaz
7. `project-map.md` guncelle

### Yeni API Endpoint Ekleme
1. Route dosyasi olustur/guncelle (`routes/*.py`)
2. Schema olustur (`schemas/*.py`)
3. Client fonksiyonu ekle (`client.ts`)
4. Audit logging ekle (mutasyon ise)
5. RBAC guard ekle
6. Test yaz (3 rol)
7. `project-map.md` guncelle

### DB Model Degisikligi
1. Model guncelle (`models/*.py`)
2. Migration olustur (`alembic revision`)
3. Repository guncelle (`domain_repo.py`)
4. Route guncelle (gerekiyorsa)
5. Schema guncelle (gerekiyorsa)
6. Test guncelle
7. ADR yaz + `project-map.md` guncelle
