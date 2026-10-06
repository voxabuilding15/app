import { I18nManager } from 'react-native';

import { restartApp } from '@/services/restart';
import { kvStorage } from '@/services/storage';

const ATTEMPT_KEY = 'i18n.direction-attempt';

export type DirectionStep = 'none' | 'restart' | 'blocked';

/**
 * What to do so the layout direction matches the language. React Native reads the direction when
 * the app starts, so a change needs one restart; if one already happened for this direction and it
 * still does not match (an unsupported device), the app carries on instead of restarting forever.
 */
export function planDirection(
  currentlyRtl: boolean,
  wantRtl: boolean,
  attemptedFor: string | undefined,
): DirectionStep {
  if (currentlyRtl === wantRtl) {
    return 'none';
  }
  return attemptedFor === String(wantRtl) ? 'blocked' : 'restart';
}

export type DirectionResult = 'unchanged' | 'restarting' | 'manual';

/**
 * Makes the layout direction match `wantRtl`, restarting the app when that is needed. `manual`
 * means the restart did not happen and the user has to reopen the app.
 */
export async function applyDirection(wantRtl: boolean): Promise<DirectionResult> {
  const step = planDirection(I18nManager.isRTL, wantRtl, kvStorage.getString(ATTEMPT_KEY));
  if (step === 'none') {
    kvStorage.remove(ATTEMPT_KEY);
    return 'unchanged';
  }
  if (step === 'blocked') {
    return 'unchanged';
  }
  kvStorage.setString(ATTEMPT_KEY, String(wantRtl));
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(wantRtl);
  return (await restartApp()) ? 'restarting' : 'manual';
}

/** Whether the layout direction is right for the language, without changing anything. */
export function directionMatches(wantRtl: boolean): boolean {
  return I18nManager.isRTL === wantRtl;
}
