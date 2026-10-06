/** XP needed to reach `level`: 100, 300, 600, 1000 ... (50 × (level − 1) × level). */
export function xpForLevel(level: number): number {
  return 50 * (level - 1) * level;
}

export const MAX_LEVEL = 99;

export interface LevelProgress {
  level: number;
  /** XP earned inside the current level. */
  into: number;
  /** XP the current level spans; 0 at the top level. */
  span: number;
  /** 0 to 1 towards the next level; 1 at the top level. */
  fraction: number;
}

export function levelForXp(xp: number): LevelProgress {
  const total = Math.max(0, Math.floor(xp));
  let level = 1;
  while (level < MAX_LEVEL && total >= xpForLevel(level + 1)) {
    level += 1;
  }
  if (level === MAX_LEVEL) {
    return { level, into: total - xpForLevel(level), span: 0, fraction: 1 };
  }
  const floor = xpForLevel(level);
  const span = xpForLevel(level + 1) - floor;
  return { level, into: total - floor, span, fraction: (total - floor) / span };
}

/** Rank names for ranges of levels. */
const TITLES: readonly { from: number; title: string }[] = [
  { from: 1, title: 'Beginner' },
  { from: 5, title: 'Apprentice' },
  { from: 10, title: 'Achiever' },
  { from: 20, title: 'Expert' },
  { from: 35, title: 'Master' },
  { from: 50, title: 'Legend' },
];

export function levelTitle(level: number): string {
  let title = TITLES[0]?.title ?? '';
  for (const entry of TITLES) {
    if (level >= entry.from) {
      title = entry.title;
    }
  }
  return title;
}
