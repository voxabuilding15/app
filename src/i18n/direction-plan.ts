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
