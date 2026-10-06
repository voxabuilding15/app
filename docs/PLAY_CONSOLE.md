# Google Play Console answers for FocusFlow

Answers are based on what the app does today: it is fully offline, has no account, no ads, no analytics and makes no network requests. Re-check them if that changes.

## Store listing

- **App name:** FocusFlow
- **Category:** Productivity
- **Tags:** to-do list, habit tracker, planner, notes, pomodoro
- **Short description (80 max):** Tasks, habits, calendar, finance, notes and focus timer. Private and offline.
- **Full description:**

  FocusFlow keeps your whole day in one place and never needs an account or an internet connection.

  • Tasks – priorities, due dates, subtasks, repeats and reminders
  • Habits – daily, weekly and monthly goals with streaks and a heatmap
  • Calendar – month, week, day and agenda views with drag and drop
  • Finance – accounts, income and expenses, budgets and recurring transactions
  • Notes – Markdown, folders, tags, attachments, drawings, voice notes and a private lock
  • Pomodoro – customizable focus and break timer that keeps running with the app closed, ambient sounds, goals and a focus score
  • Statistics – daily, weekly, monthly and yearly overview with a productivity score; export as PDF or CSV
  • Achievements – XP, levels, badges and challenges
  • Backup – export and restore everything as a JSON file, with automatic local backups

  Your data stays on your device. There are no ads, no tracking and no sign-up.

- **Graphics:** 512×512 icon (`assets/images/icon.png` resized), 1024×500 feature graphic, ≥2 phone screenshots, tablet screenshots (7" and 10").

## App content

- **Privacy policy URL:** host `docs/PRIVACY_POLICY.md` (fill in your contact email) and enter the URL.
- **Ads:** No.
- **App access:** All functionality is available without login or special access.
- **Target audience:** 13+ (or "18 and over" if you prefer the simplest review). Not designed for children.
- **Content rating (IARC):** Utility/productivity app; no violence, sexual content, gambling, user-generated content shared with others, or location sharing. Expect rating **Everyone**.
- **News app / COVID / government / financial features:** No. The Finance feature is a personal ledger only: it does not move money, offer loans or connect to banks.
- **Health:** No (the Pomodoro and habit features are not medical).

## Data safety

- **Does the app collect or share any user data?** **No.**
- All data (tasks, notes, finance entries, habits, recordings, backups) is stored on the device only and is never transmitted.
- **Is all data encrypted in transit?** Not applicable (no data is transmitted).
- **Can users request data deletion?** Data lives only on the device; users delete it in Settings → Data management or by uninstalling.
- Declare **no** third-party SDKs that collect data (none are used).

## Permissions

| Permission                                                                         | Why                                                            | Notes for review                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST_NOTIFICATIONS`                                                               | Task, habit, calendar, note and timer reminders                | Requested when the user first sets a reminder or starts a timer                                                                                                                                                |
| `SCHEDULE_EXACT_ALARM`                                                             | Reminders, alarms and focus-timer phase ends at the exact time | Core function is reminders/timers. On Android 14+ the user must allow it; the app still works with inexact timing if they do not. Complete any exact-alarm declaration the Console asks for using this reason. |
| `RECEIVE_BOOT_COMPLETED`                                                           | Re-schedule reminders after a restart                          |                                                                                                                                                                                                                |
| `VIBRATE`                                                                          | Vibrate when a focus or break phase ends                       |                                                                                                                                                                                                                |
| `RECORD_AUDIO`                                                                     | Voice notes in Notes                                           | Recorded only after the user taps record; stored on the device                                                                                                                                                 |
| `USE_BIOMETRIC` / `USE_FINGERPRINT`                                                | Unlock locked notes                                            | Biometric result is handled by Android; no biometric data is read by the app                                                                                                                                   |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `MODIFY_AUDIO_SETTINGS` | Ambient focus sounds keep playing with the screen off          | Declare the foreground service type **Media playback**. Play asks for a short demo video: start a focus session with an ambient sound, lock the phone, show the sound and lock-screen controls continuing.     |
| `INTERNET`                                                                         | Added automatically by the Expo framework                      | The app makes no network requests                                                                                                                                                                              |

Explicitly removed: external storage, calendar and "draw over other apps" permissions.

## Testing and rollout

1. Internal testing (you, up to 100 testers) – verifies the upload works.
2. Closed testing – personal developer accounts need **12 testers opted-in for 14 continuous days** before applying for production.
3. Production – start with a staged rollout and watch Android vitals (crashes, ANRs) in the Console.
