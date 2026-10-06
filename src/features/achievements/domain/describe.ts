import { ALL_ACHIEVEMENTS, type Tier } from './catalog';
import { CHALLENGE_TEMPLATES } from './challenges';
import type { Unlock, UnlockKind } from './entities';
import { msg } from '@/i18n/msg';

/** What to show for an unlock, in English with placeholders for the screens to translate. */
export interface UnlockText {
  kind: UnlockKind;
  title: string;
  description: string;
  count: number;
  icon: string;
  tier: Tier | null;
}

/** `challenge:week:2026-10-12:tasks` becomes its parts. */
function parseChallenge(ref: string): { period: 'week' | 'month'; templateId: string } | null {
  const [prefix, period, , templateId] = ref.split(':');
  return prefix === 'challenge' &&
    (period === 'week' || period === 'month') &&
    templateId !== undefined
    ? { period, templateId }
    : null;
}

export function describeUnlock(unlock: Pick<Unlock, 'kind' | 'ref'>): UnlockText | null {
  if (unlock.kind === 'challenge') {
    const parsed = parseChallenge(unlock.ref);
    const template = CHALLENGE_TEMPLATES.find((item) => item.id === parsed?.templateId);
    if (parsed === null || template === undefined) {
      return null;
    }
    return {
      kind: 'challenge',
      title: template.title,
      description:
        parsed.period === 'week'
          ? msg('Weekly challenge completed')
          : msg('Monthly challenge completed'),
      count: template[parsed.period],
      icon: 'flag',
      tier: null,
    };
  }
  const def = ALL_ACHIEVEMENTS.find((item) => item.id === unlock.ref && item.group === unlock.kind);
  if (def === undefined) {
    return null;
  }
  return {
    kind: unlock.kind,
    title: def.title,
    description: def.description,
    count: def.count,
    icon: def.icon,
    tier: def.tier ?? null,
  };
}
