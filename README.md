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
- The Finance currency is one app-wide setting; once accounts exist it can only change to a currency with the same number of decimals, so amounts are never silently reinterpreted.
- Dependencies are added in the phase that first uses them (no unused native modules ship).
