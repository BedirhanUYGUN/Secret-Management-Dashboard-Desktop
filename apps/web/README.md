# Web Uygulamasi

Bu paket Secret Management Dashboard'in web arayuzunu icerir.

## Klasor Yapisi

```text
apps/web/src/
├── app/                 # Router ve uygulama composition katmani
├── core/                # Ortak altyapi katmani
│   ├── api/             # HTTP client
│   ├── auth/            # Auth context + route guards
│   ├── layout/          # Main layout
│   ├── platform/        # Browser/Tauri runtime soyutlamasi
│   ├── ui/              # Ortak UI bilesenleri
│   └── types.ts         # Ortak tipler
├── features/            # Ozellik bazli moduller
│   ├── auth/
│   ├── projects/
│   ├── project-manage/
│   ├── users/
│   ├── import/
│   ├── audit/
│   ├── search/
│   ├── settings/
│   └── not-found/
└── test/                # Vitest + RTL testleri
```

## Import Aliaslari

`tsconfig.app.json` ve `vite.config.ts` icinde su aliaslar tanimlidir:

- `@app/*` -> `src/app/*`
- `@core/*` -> `src/core/*`
- `@features/*` -> `src/features/*`

## Komutlar

- Gelistirme: `npm run dev -w apps/web`
- Lint: `npm run lint -w apps/web`
- Typecheck: `npm run typecheck -w apps/web`
- Test: `npm run test -w apps/web`
- Build: `npm run build -w apps/web`
