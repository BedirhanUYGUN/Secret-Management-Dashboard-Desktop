---
trigger: always_on
---

# Commit Message Output Rule

Bu kural, kod uretimi sonrasindaki cikti formatini zorunlu kilmak icindir.

## Zorunlu Davranis
- Her kod degisikligi tamamlandiginda, kisa ve madde madde bir commit mesaji onerisi ver.
- Oneri Conventional Commits formatina uygun olsun.
- Onerilen mesaj, degisikligin amacini kisa ifade etsin.
- Commit mesaji ve madde aciklamalari Turkce yazilsin.
- yaptım, duzenledim gibi 1. tekil şahıs kullanma. Yapıldı, duzenlendi yapıda kullan. 
## Format
- Ilk satir: `type(scope): konu`
- Alt satirlar: kisa maddeler (neden/etki)

Ornek:
`feat(auth): guvenli oturum kaliciligi ekle`
- access token bilgisini secure storage ile sakla
- oturum yenileme akisinda tutarliligi artir

## Yasaklar
- `git push` komutu calistirma.
- Uzak repoya gonderim, force push veya release islemi yapma.
- Kullanici acikca istemedikce commit olusturma; sadece mesaj oner.