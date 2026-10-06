# FocusFlow performance report

Measured on the build container with Node's built-in SQLite running the app's real SQL and use cases (`npm run perf`). A phone is slower, so read these as relative costs, not device timings.

Data set: tasks: 5,000, habit_logs: 15,416, events: 1,500, transactions: 10,000, notes: 2,000, pomodoro_sessions: 5,000; database about 5.4 MB; built in 1001 ms.

| Operation                    | Fastest (ms) | Median (ms) | Slowest (ms) |
| ---------------------------- | -----------: | ----------: | -----------: |
| Statistics: day              |         53.9 |        57.2 |        125.6 |
| Statistics: week             |         60.4 |        76.6 |         94.9 |
| Statistics: month            |         67.6 |        84.3 |        110.4 |
| Statistics: year             |        195.0 |       254.9 |        258.0 |
| Achievements: check          |         25.8 |        28.0 |         33.4 |
| Focus statistics (400 days)  |          7.2 |         8.1 |          8.7 |
| Tasks: active list           |          2.3 |         2.5 |          3.8 |
| Tasks: search                |          1.6 |         1.6 |          1.9 |
| Habits: all with history     |         32.0 |        32.9 |         35.2 |
| Calendar: two months         |          1.3 |         1.5 |          1.8 |
| Finance: recent transactions |          0.8 |         1.1 |          2.6 |
| Notes: list                  |          6.9 |         7.2 |         16.1 |
| Backup: create               |        258.5 |       275.3 |        294.6 |
| Backup: check file           |         91.6 |        98.3 |        137.7 |
| Backup: merge identical data |        645.0 |       689.1 |        752.9 |
| Backup: replace everything   |       1647.9 |      1811.1 |       1946.9 |

## Bundle (Android, Hermes bytecode, `expo export`)

| Build           | JS bundle |  Assets |
| --------------- | --------: | ------: |
| Before Pomodoro |   5.74 MB | 1.35 MB |
| Final           |   6.17 MB | 1.53 MB |

## Verification

- Node tests (domain, repository, integration, query plans, migrations, offline audit, performance budgets): 676 pass in each of UTC, America/New_York and Asia/Kolkata.
- UI tests (jest-expo): 423 pass in 43 suites, including accessibility, memory-leak and offline checks.
- Typecheck, ESLint (0 warnings) and Prettier are clean; `expo prebuild` succeeds and the manifest permissions are as expected.
- `expo-doctor`: 19 of 21 checks pass; the two failures need `api.expo.dev` and `reactnative.directory`, which are unreachable here.
- Not done: a Gradle build and on-device measurements (`dl.google.com` is unreachable).
