# FocusFlow

Offline-first productivity app (tasks, habits, finance, notes, calendar, Pomodoro, reminders and alarms).
React Native + Expo (SDK 57) + TypeScript + Expo Router. No backend, no AI; all data stays on the device.

## Scripts

| Command                  | Purpose                                   |
| ------------------------ | ----------------------------------------- |
| `npm start`              | Start Metro (use a development build)     |
| `npm run android`        | Build and run the dev client on Android   |
| `npm run typecheck`      | `tsc --noEmit`                            |
| `npm run lint`           | ESLint, zero warnings allowed             |
| `npm run doctor`         | `expo-doctor`                             |
| `npm run export:android` | Bundle the Android JS (Hermes) for CI     |

MMKV and SQLite are native modules, so Expo Go is not supported; use a development build.

## Architecture

Clean Architecture, enforced by ESLint `no-restricted-imports` (see `eslint.config.js`):

```
src/
  core/        ports (Database, KeyValueStorage, NotificationService) + DI context   <- innermost, imports nothing
  database/    SQLite client, versioned migrations (PRAGMA user_version)
  services/    adapters implementing core ports (MMKV storage, expo-notifications)
  theme/       Material 3 tokens, light/dark/system provider
  components/  design-system primitives (ui/)
  hooks/       shared hooks
  features/*   one folder per feature (screens, components; domain/data layers added per phase)
  navigation/  drawer content and route metadata
  providers/   composition root: binds adapters to ports, wraps the app
  app/         Expo Router route files (thin wrappers around feature screens)
```

Dependency rule: `core` ← `database`/`services` ← `theme`/`components`/`hooks` ← `features` ← `app`.
Features talk to infrastructure only through `core` ports; the composition root is `providers/createContainer.ts`.

## Conventions

- Components and screens: `PascalCase.tsx`. Hooks: `useThing.ts`. Other modules: `kebab-case.ts`.
- Every folder exposes a barrel `index.ts`; import across layers through it.
- Money is stored as integer minor units; timestamps as epoch ms; calendar dates as `YYYY-MM-DD`.
- Dependencies are added in the phase that first uses them (no unused native modules ship).
