import { currentTranslator } from '@/i18n/translate';
export type AmbientSound = 'none' | 'white-noise' | 'rain' | 'forest' | 'coffee-shop';

export const AMBIENT_SOUNDS: readonly AmbientSound[] = [
  'none',
  'white-noise',
  'rain',
  'forest',
  'coffee-shop',
];

export interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  /** Focus sessions before a long break replaces the short one. */
  sessionsUntilLongBreak: number;
  /** Start the break by itself when a focus session ends. */
  autoStartBreaks: boolean;
  /** Start the next focus session by itself when a break ends. */
  autoStartFocus: boolean;
  tickSound: boolean;
  vibrate: boolean;
  ambientSound: AmbientSound;
  /** Minutes of focus per day, week and month to aim for; 0 turns a goal off. */
  dailyGoalMinutes: number;
  weeklyGoalMinutes: number;
  monthlyGoalMinutes: number;
  /** Ring the end of a phase through the alarm channel, which can bypass Do Not Disturb. */
  exactAlarm: boolean;
}

export const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  tickSound: false,
  vibrate: true,
  ambientSound: 'none',
  dailyGoalMinutes: 100,
  weeklyGoalMinutes: 500,
  monthlyGoalMinutes: 2000,
  exactAlarm: false,
};

interface Range {
  min: number;
  max: number;
}

export const SETTING_RANGES = {
  focusMinutes: { min: 1, max: 180 },
  shortBreakMinutes: { min: 1, max: 60 },
  longBreakMinutes: { min: 1, max: 120 },
  sessionsUntilLongBreak: { min: 2, max: 12 },
  dailyGoalMinutes: { min: 0, max: 720 },
  weeklyGoalMinutes: { min: 0, max: 5_040 },
  monthlyGoalMinutes: { min: 0, max: 21_600 },
} as const satisfies Record<string, Range>;

type NumericSetting = keyof typeof SETTING_RANGES;
const NUMERIC_SETTINGS = Object.keys(SETTING_RANGES) as NumericSetting[];
const FLAGS = ['autoStartBreaks', 'autoStartFocus', 'tickSound', 'vibrate', 'exactAlarm'] as const;

export type SettingsErrors = Partial<Record<NumericSetting, string>>;

export function validateSettings(settings: PomodoroSettings): SettingsErrors {
  const { t } = currentTranslator();
  const errors: SettingsErrors = {};
  for (const key of NUMERIC_SETTINGS) {
    const { min, max } = SETTING_RANGES[key];
    const value = settings[key];
    if (!Number.isInteger(value) || value < min || value > max) {
      errors[key] = t('Choose a whole number from {min} to {max}', { min: min, max: max });
    }
  }
  return errors;
}

/** Reads stored settings, replacing anything missing or out of range with the default. */
export function normalizeSettings(raw: unknown): PomodoroSettings {
  const data = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const result: PomodoroSettings = { ...DEFAULT_SETTINGS };

  for (const key of NUMERIC_SETTINGS) {
    const { min, max } = SETTING_RANGES[key];
    const value = data[key];
    if (typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max) {
      result[key] = value;
    }
  }
  for (const key of FLAGS) {
    if (typeof data[key] === 'boolean') {
      result[key] = data[key];
    }
  }
  if (AMBIENT_SOUNDS.includes(data.ambientSound as AmbientSound)) {
    result.ambientSound = data.ambientSound as AmbientSound;
  }
  return result;
}
