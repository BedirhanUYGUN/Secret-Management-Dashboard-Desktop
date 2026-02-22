# Desktop (Tauri)

Bu uygulama artik `apps/web` arayuzunu ve API client'ini paylasir.

## Calistirma

- API icin `VITE_API_BASE_URL` tanimli olmali (varsayilan: `http://localhost:4000`)
- Desktop modunda API origin'i `VITE_ALLOWED_API_ORIGINS` listesinde olmali
- Gelistirme: `npm run dev -w apps/desktop`
- Masaustu (Tauri): `npm run tauri -w apps/desktop`

## Desktop notlari

- Oturum token'lari keychain/credential store uzerinden saklanir
- Tauri pencere icinde kisayollar aktiftir (`Ctrl+1..4`, `Ctrl+Shift+L`)
