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

## Structure

`src/app` routes (Expo Router) · `src/features/*` feature modules · `src/components/ui` design system ·
`src/core` DI container and errors · `src/database` SQLite client and migrations ·
`src/services` storage and notifications · `src/theme` Material 3 theme · `src/providers` app providers.
