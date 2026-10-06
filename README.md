# FocusFlow

Offline-first productivity app (tasks, habits, finance, notes, calendar, Pomodoro, reminders and alarms).
React Native + Expo (SDK 57) + TypeScript + Expo Router. No backend, no AI; all data stays on the device.

## Scripts

| Command                  | Purpose                                   |
| ------------------------ | ----------------------------------------- |
| `npm start`              | Start Metro (use a development build)     |
| `npm run android`        | Build and run the dev client on Android   |
| `npm run typecheck`      | `tsc --noEmit` for the app and for tests  |
| `npm run lint`           | ESLint, zero warnings allowed             |
| `npm run doctor`         | `expo-doctor`                             |
| `npm run export:android` | Bundle the Android JS (Hermes) for CI     |
| `npm test`               | Domain + SQLite tests (Node), run in 3 time zones |
| `npm run test:ui`        | Screen tests (jest-expo) against real SQLite      |
| `npm run test:all`       | Both test suites                                  |

MMKV and SQLite are native modules, so Expo Go is not supported; use a development build.

## Architecture

Clean Architecture, enforced by ESLint `no-restricted-imports` (see `eslint.config.js`):

```
src/
  core/        ports, DI context, dates, shared category rules, notification helpers  <- innermost, imports nothing
  database/    SQLite client, versioned migrations (PRAGMA user_version)
  services/    adapters implementing core ports (MMKV storage, expo-notifications)
  theme/       Material 3 tokens, light/dark/system provider
  components/  design system: ui/ primitives and charts/ (ProgressRing, BarChart, GroupedBarChart, DonutChart, Heatmap, StatTile)
  hooks/       shared hooks
  features/*   one folder per feature, each with domain/ (entities, use cases, ports),
               data/ (SQLite and notification adapters) and presentation/ (view models, screens, components)
  navigation/  drawer content and route metadata
  providers/   composition root: binds adapters to ports, wraps the app
  app/         Expo Router route files (thin wrappers around feature screens)
```

Dependency rule: `core` ← `database`/`services` ← `theme`/`components`/`hooks` ← `features` ← `app`.
Features talk to infrastructure only through `core` ports; the composition root is `providers/createContainer.ts`.

## Conventions

- Components and screens: `PascalCase.tsx`. Hooks: `useThing.ts`. Other modules: `kebab-case.ts`.
- Every folder exposes a barrel `index.ts`; import across layers through it.
- Money is stored as integer minor units and converted to and from text only by `core/money.ts`; timestamps are epoch ms; calendar dates are `YYYY-MM-DD`.
- Notes are stored as Markdown; attachments (images, PDFs, voice notes and drawings) live in the app's document folder and are referenced by relative path. Locking a note gates the UI (PIN hash or the phone's own lock) but does not encrypt the stored text.
- The Pomodoro timer is stored as absolute times (`endsAt`, or `remainingMs` while paused) in key-value storage, never as a countdown. `reconcile` brings it up to date from the clock, so it keeps running in the background and recovers after the app is killed: every phase that ended meanwhile is saved at its real end time and, with auto-start on, the next ones are chained from there. Phase ends are scheduled as notifications with the system, and the ongoing notification's buttons (Pause, Resume, Skip, Stop) open the app, which applies them. The exact-alarm setting routes phase-end alerts through the `alarms` channel (`SCHEDULE_EXACT_ALARM` is declared). Ambient sounds are looping files in `assets/sounds` (made by `scripts/generate-sounds.py`) and play through expo-audio with lock screen controls; this needs the audio plugin's background playback, which adds the foreground-service permissions.
- The Finance currency is one app-wide setting; once accounts exist it can only change to a currency with the same number of decimals, so amounts are never silently reinterpreted.
- Dependencies are added in the phase that first uses them (no unused native modules ship).

## Languages (English, French, Arabic)

- Phrases are keyed by their English text and live in `src/i18n/locales/<language>/<area>.json` (one file per feature, plus `common`, `navigation` and `notifications`). Write `t('Save')`, `t('{count} items', …)` with `{placeholder}` values, and `tn(count, 'one text', 'other text')` for plurals (Arabic uses all six plural forms).
- Hooks use `useTranslator()`. Code outside React (domain messages, notifications) uses `currentTranslator()` from `@/i18n/translate`. Text in module-level tables is marked with `msg('…')` and translated where it is shown, or with `translatedLabels({…})` for lookup tables.
- Domain code and Node tests import the light modules (`@/i18n/msg`, `translate`, `formatting`, `labels`, `languages`), never the `@/i18n` barrel, which pulls in native modules.
- The preference is `system`, `en`, `fr` or `ar`, kept in MMKV. `system` follows the phone's language and is re-read when the app returns to the foreground. The Settings screen changes it.
- Arabic is right to left. React Native swaps left and right once the direction is applied at startup, so switching to or from Arabic restarts the app (with a loop guard). Directional icons are mirrored by `Icon`, and Arabic uses Western digits.
- PDF reports use the built-in Helvetica font, which cannot draw Arabic, so Arabic reports are exported in English (the app says so). CSV files start with a UTF-8 byte order mark.
- Tooling: `node scripts/i18n.mjs extract` refreshes the English files from the code, `check` fails when a language lacks a phrase, plural form or placeholder (it runs in the tests), `todo <lang>` lists what is missing and `merge <lang> file.json` adds translations.
- To add a language: add it to `src/i18n/languages.ts` and the `LANGUAGES` list in `scripts/i18n.mjs`, copy the English folder, translate it, and register it in `resources.ts`.
