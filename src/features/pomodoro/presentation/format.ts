import type { IconName } from '@/components';
import { dateKeyToNoon, type DateKey } from '@/core';

import type { SessionOutcome, TimerKind } from '../domain/timer';
import type { AmbientSound } from '../domain/settings';
import { msg } from '@/i18n/msg';
import { currentTranslator } from '@/i18n/translate';
import { appLocale } from '@/i18n/formatting';

export const KIND_LABEL: Record<TimerKind, string> = {
  focus: msg('Focus'),
  short_break: msg('Short break'),
  long_break: msg('Long break'),
};

export const OUTCOME_LABEL: Record<SessionOutcome, string> = {
  completed: msg('Completed'),
  stopped: msg('Stopped early'),
  skipped: msg('Skipped'),
};

export const SOUND_LABEL: Record<AmbientSound, string> = {
  none: msg('Off'),
  'white-noise': msg('White noise'),
  rain: msg('Rain'),
  forest: msg('Forest'),
  'coffee-shop': msg('Coffee shop'),
};

export const SOUND_ICON: Record<AmbientSound, IconName> = {
  none: 'volume-off',
  'white-noise': 'graphic-eq',
  rain: 'water-drop',
  forest: 'park',
  'coffee-shop': 'local-cafe',
};

/** "1h 25m", "45m" or "30s". */
export function formatFocusTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours === 0) {
    return `${minutes}m`;
  }
  return minutes % 60 === 0 ? `${hours}h` : `${hours}h ${minutes % 60}m`;
}

/** "24:05" for a countdown, "1:05:00" past an hour. */
export function formatClockFace(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

/** Spoken form of a countdown: "24 minutes 5 seconds". */
export function speakClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const part = (value: number, unit: string) => `${value} ${unit}${value === 1 ? '' : 's'}`;
  return minutes === 0
    ? part(seconds, 'second')
    : seconds === 0
      ? part(minutes, 'minute')
      : `${part(minutes, 'minute')} ${part(seconds, 'second')}`;
}

export function formatStartTime(at: number): string {
  return new Date(at).toLocaleString(appLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDayLabel(key: DateKey): string {
  return new Date(dateKeyToNoon(key)).toLocaleDateString(appLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function shortMonth(key: DateKey): string {
  return new Date(dateKeyToNoon(key)).toLocaleDateString(appLocale(), { month: 'short' });
}

/** Short axis label for a statistics bucket. */
export function formatBucketLabel(period: 'day' | 'week' | 'month', from: DateKey): string {
  const date = new Date(dateKeyToNoon(from));
  switch (period) {
    case 'day':
      return date.toLocaleDateString(appLocale(), { weekday: 'narrow' });
    case 'week':
      return String(date.getDate());
    default:
      return date.toLocaleDateString(appLocale(), { month: 'narrow' });
  }
}

export function formatBucketDescription(
  period: 'day' | 'week' | 'month',
  from: DateKey,
  to: DateKey,
): string {
  const { t } = currentTranslator();
  if (period === 'day') {
    return formatDayLabel(from);
  }
  if (period === 'week') {
    return t('Week of {dayLabel} to {dayLabel2}', {
      dayLabel: formatDayLabel(from),
      dayLabel2: formatDayLabel(to),
    });
  }
  return new Date(dateKeyToNoon(from)).toLocaleDateString(appLocale(), {
    month: 'long',
    year: 'numeric',
  });
}
