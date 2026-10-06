import type { CounterId, Lifetime } from './entities';

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type AchievementGroup = 'badge' | 'milestone' | 'streak';

export interface AchievementDef {
  id: string;
  group: AchievementGroup;
  /** English text; the screens translate it. */
  title: string;
  description: string;
  /** What `{count}` stands for in the texts. */
  count: number;
  icon: string;
  xp: number;
  tier?: Tier;
  /** What the badge is measured by, when it is a simple threshold. */
  counter?: CounterId;
  target?: number;
  /** For special badges that need more than one number. */
  test?: (lifetime: Lifetime, context: { level: number }) => boolean;
}

const TIERS: readonly Tier[] = ['bronze', 'silver', 'gold', 'platinum'];
const TIER_XP: Record<Tier, number> = { bronze: 25, silver: 50, gold: 100, platinum: 200 };

interface MilestoneLine {
  counter: CounterId;
  title: string;
  describe: string;
  icon: string;
  /** Targets for bronze, silver, gold and platinum. */
  targets: readonly [number, number, number, number];
  /** Converts the target to the number shown in the texts (minutes to hours, say). */
  shown?: (target: number) => number;
}

const MILESTONE_LINES: readonly MilestoneLine[] = [
  {
    counter: 'tasks',
    title: 'Task finisher',
    describe: 'Complete {count} tasks',
    icon: 'check-circle',
    targets: [10, 50, 250, 1000],
  },
  {
    counter: 'checkIns',
    title: 'Habit builder',
    describe: 'Check in {count} times on your habits',
    icon: 'local-fire-department',
    targets: [25, 100, 500, 2000],
  },
  {
    counter: 'focusMinutes',
    title: 'Deep worker',
    describe: 'Focus for {count} hours',
    icon: 'timer',
    targets: [300, 1500, 6000, 30000],
    shown: (minutes) => minutes / 60,
  },
  {
    counter: 'focusSessions',
    title: 'Session streaker',
    describe: 'Finish {count} focus sessions',
    icon: 'self-improvement',
    targets: [10, 50, 250, 1000],
  },
  {
    counter: 'notes',
    title: 'Note taker',
    describe: 'Write {count} notes',
    icon: 'sticky-note-2',
    targets: [10, 50, 200, 1000],
  },
  {
    counter: 'events',
    title: 'Planner',
    describe: 'Schedule {count} events',
    icon: 'event',
    targets: [10, 50, 200, 1000],
  },
  {
    counter: 'transactions',
    title: 'Money tracker',
    describe: 'Record {count} transactions',
    icon: 'account-balance-wallet',
    targets: [25, 100, 500, 2500],
  },
];

const FIRST_STEPS: readonly { id: string; counter: CounterId; title: string; icon: string }[] = [
  { id: 'first-task', counter: 'tasks', title: 'First task done', icon: 'check-circle' },
  {
    id: 'first-habit',
    counter: 'checkIns',
    title: 'First habit check-in',
    icon: 'local-fire-department',
  },
  { id: 'first-focus', counter: 'focusSessions', title: 'First focus session', icon: 'timer' },
  { id: 'first-note', counter: 'notes', title: 'First note', icon: 'sticky-note-2' },
  { id: 'first-event', counter: 'events', title: 'First event', icon: 'event' },
  {
    id: 'first-transaction',
    counter: 'transactions',
    title: 'First transaction',
    icon: 'account-balance-wallet',
  },
];

const STREAK_REWARDS: readonly { days: number; xp: number }[] = [
  { days: 3, xp: 15 },
  { days: 7, xp: 40 },
  { days: 14, xp: 75 },
  { days: 30, xp: 150 },
  { days: 60, xp: 300 },
  { days: 100, xp: 500 },
  { days: 365, xp: 1000 },
];

const FIRST_STEP_XP = 20;
const COUNTER_IDS: readonly CounterId[] = FIRST_STEPS.map((step) => step.counter);

export const BADGES: readonly AchievementDef[] = [
  ...FIRST_STEPS.map((step): AchievementDef => ({
    id: step.id,
    group: 'badge',
    title: step.title,
    description: 'Your very first one',
    count: 1,
    icon: step.icon,
    xp: FIRST_STEP_XP,
    counter: step.counter,
    target: 1,
  })),
  {
    id: 'all-rounder',
    group: 'badge',
    title: 'All-rounder',
    description: 'Use tasks, habits, focus, notes, events and money at least once',
    count: 0,
    icon: 'workspace-premium',
    xp: 100,
    test: (lifetime) => COUNTER_IDS.every((id) => lifetime[id] > 0),
  },
  {
    id: 'marathon',
    group: 'badge',
    title: 'Marathon focus',
    description: 'Stay with one focus session for {count} minutes',
    count: 90,
    icon: 'hourglass-top',
    xp: 50,
    test: (lifetime) => lifetime.longestFocusMinutes >= 90,
  },
  ...[5, 10, 25].map((level): AchievementDef => ({
    id: `level-${level}`,
    group: 'badge',
    title: 'Level {count}',
    description: 'Reach level {count}',
    count: level,
    icon: 'military-tech',
    xp: level * 10,
    test: (_lifetime, context) => context.level >= level,
  })),
];

export const MILESTONES: readonly AchievementDef[] = MILESTONE_LINES.flatMap((line) =>
  line.targets.map((target, index): AchievementDef => {
    const tier = TIERS[index] ?? 'bronze';
    return {
      id: `${line.counter}-${tier}`,
      group: 'milestone',
      title: line.title,
      description: line.describe,
      count: line.shown === undefined ? target : line.shown(target),
      icon: line.icon,
      xp: TIER_XP[tier],
      tier,
      counter: line.counter,
      target,
    };
  }),
);

export const STREAK_BADGES: readonly AchievementDef[] = STREAK_REWARDS.map(
  (reward): AchievementDef => ({
    id: `streak-${reward.days}`,
    group: 'streak',
    title: '{count}-day streak',
    description: 'Do something useful {count} days in a row',
    count: reward.days,
    icon: 'bolt',
    xp: reward.xp,
    target: reward.days,
  }),
);

export const ALL_ACHIEVEMENTS: readonly AchievementDef[] = [
  ...BADGES,
  ...MILESTONES,
  ...STREAK_BADGES,
];
