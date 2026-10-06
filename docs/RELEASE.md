# Releasing FocusFlow to Google Play

This guide takes the project from the repository to a published release. The signed bundle (`.aab`) has to be built with **your** keystore, so it is built on your machine (or on EAS), not committed to the repository.

> The cloud sandbox this project was prepared in has no Android SDK and cannot download one, so no `.aab` has been built or run on a device yet. Everything below is configured and checked statically; the first real build is step 4.

## 1. Check the project

```bash
npm ci
npm run typecheck && npm run lint && npm test && npm run test:ui
npm run verify:release        # production settings: version, id, icons, permissions, secrets
npx expo-doctor
```

`verify:release` must print `all checks passed` before you build.

## 2. Decide the permanent values (before the first upload)

- **Application id** – `com.focusflow.app` in `app.json` (`android.package`). It can never change after the first upload and must be unique on Google Play. Change it now if you own a different domain.
- **App name** – `FocusFlow` (`app.json` `name`).
- **Version** – `version` (shown to users) and `android.versionCode` (integer, must increase with every upload). Keep `APP_VERSION` in `src/constants/app.ts` equal to `version`; `verify:release` checks this.

## 3. Create the upload keystore (once)

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore focusflow-upload.jks -alias focusflow-upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

- Store `focusflow-upload.jks` and its passwords in a password manager and make an offline copy. **Never commit it** (`*.jks` is git-ignored, and `verify:release` fails if one is tracked).
- Enrol in **Play App Signing** when you create the app (the default). Google keeps the real app-signing key; this keystore is only your _upload_ key, and Google can reset it if you lose it.

## 4. Build the signed bundle

### Option A – on your machine (JDK 17 and the Android SDK installed)

```bash
npx expo prebuild --platform android --clean
export FOCUSFLOW_KEYSTORE_FILE=/absolute/path/focusflow-upload.jks
export FOCUSFLOW_KEYSTORE_PASSWORD=...
export FOCUSFLOW_KEY_ALIAS=focusflow-upload
export FOCUSFLOW_KEY_PASSWORD=...
cd android && ./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`.

`plugins/with-release-signing.js` signs the release with that keystore and **refuses to build a release without it**, so you cannot accidentally produce a debug-signed bundle (Google Play rejects those).

### Option B – EAS Build (needs a free Expo account)

```bash
npm i -g eas-cli && eas login
eas build --platform android --profile production
```

EAS can generate and store the upload keystore for you the first time (`eas credentials`). `eas.json` is set to produce an app bundle, with the version number taken from `app.json`.

## 5. Verify the bundle before uploading

```bash
# signed with your key, not the debug key
jarsigner -verify -verbose -certs app-release.aab | head
keytool -printcert -jarfile app-release.aab           # fingerprint must match your keystore

# inspect version, permissions and size with Google's bundletool
java -jar bundletool.jar dump manifest --bundle app-release.aab | grep -E "versionCode|versionName|package|uses-permission"
java -jar bundletool.jar build-apks --bundle app-release.aab --output app.apks --local-testing
java -jar bundletool.jar install-apks --apks app.apks
```

Install on a real phone and walk through: first launch, a task reminder and a Pomodoro timer with the app closed, a notes lock, a backup export and restore, rotation and a tablet if you have one.

Expected permissions: `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`, `RECORD_AUDIO`, `USE_BIOMETRIC`, `USE_FINGERPRINT`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `MODIFY_AUDIO_SETTINGS`, `INTERNET` (added by Expo; the app makes no network requests).

## 6. Publish on Google Play

Use `docs/PLAY_CONSOLE.md` for the exact answers to the forms.

1. **Play Console account** – pay the one-time fee at play.google.com/console and complete identity verification. New _personal_ accounts must run a **closed test with at least 12 testers for 14 days** before they can apply for production access; organisation accounts do not.
2. **Create app** – name, default language, App, Free/Paid (this cannot be changed from Free to Paid later), accept the declarations.
3. **Set up your app** (Dashboard checklist) – privacy policy URL (host `docs/PRIVACY_POLICY.md` on a public page), app access, ads (none), content rating questionnaire, target audience, Data safety, and any permission declarations the Console asks for.
4. **Store listing** – short and full description, 512×512 icon, 1024×500 feature graphic, at least 2 phone screenshots (add 7"/10" tablet screenshots; the app has a tablet layout).
5. **Internal testing** – Testing → Internal testing → Create release → upload the `.aab` → add yourself as a tester → install from the opt-in link. This is the fastest way to confirm Play accepts the bundle.
6. **Closed testing → Production** – promote the same release (or upload a new one with a higher `versionCode`), choose countries, set a staged rollout (e.g. 20%), and submit for review. Review usually takes a few days.

## 7. After release

- Every upload needs a higher `android.versionCode`; bump `version` too for user-visible changes, then rebuild.
- Keep the upload keystore and passwords safe; keep `verify:release` in your pre-release routine.
- Back-ups made in the app are plain JSON on the device; there is no server, so there is nothing to operate.

## Known limits of this build

- The bundle has not been built or run on hardware by the assistant that prepared it (no Android SDK available there); steps 4–5 are the first real test.
- Code shrinking (R8) is left at the Expo default (off). Turning it on shrinks the bundle further but must be tested on a device first.
- Only English is shipped; the Language setting lists the languages that are available.
- Google Drive backup is architecture only; it is not offered in the app yet.
