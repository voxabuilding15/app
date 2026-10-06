import type { KeyValueStorage } from '@/core';

import type { SettingsStore, TimerStore } from '../domain/ports';
import { DEFAULT_SETTINGS, normalizeSettings, type PomodoroSettings } from '../domain/settings';
import { parseTimerState } from '../domain/timer-codec';
import type { TimerState } from '../domain/timer';

const TIMER_KEY = 'pomodoro.timer';
const SETTINGS_KEY = 'pomodoro.settings';

/** Keeps the timer in the app's key-value storage so it outlives the app being killed. */
export class StorageTimerStore implements TimerStore {
  constructor(private readonly storage: KeyValueStorage) {}

  read(): TimerState {
    return parseTimerState(this.storage.getString(TIMER_KEY));
  }

  write(state: TimerState): void {
    this.storage.setString(TIMER_KEY, JSON.stringify(state));
  }
}

export class StorageSettingsStore implements SettingsStore {
  constructor(private readonly storage: KeyValueStorage) {}

  read(): PomodoroSettings {
    const raw = this.storage.getString(SETTINGS_KEY);
    if (raw === undefined) {
      return DEFAULT_SETTINGS;
    }
    try {
      return normalizeSettings(JSON.parse(raw));
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  write(settings: PomodoroSettings): void {
    this.storage.setString(SETTINGS_KEY, JSON.stringify(settings));
  }
}
