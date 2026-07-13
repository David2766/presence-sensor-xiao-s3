# Web Dashboard Translation Guide

This folder contains the translation structure for the embedded web dashboard.

Current languages:

- `en`: English
- `ko`: Korean

## Adding a Language

1. Copy `en.ts` to `<language-code>.ts`.
2. Translate only the string values.
3. Do not change object keys.
4. Add the language code to `LanguageCode` in `types.ts`.
5. Import and register the language in `index.ts`.
6. Run `npm run typecheck` from the `dashboard` directory.

Keep API paths, file names, commands, and JSON field names untranslated.

