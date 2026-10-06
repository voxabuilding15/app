/**
 * One translation file per area of the app, in every language. Text used by more than one area
 * lives in `common`. A phrase is looked up in all of them, so screens never name a namespace.
 */
export const NAMESPACES = [
  'common',
  'navigation',
  'dashboard',
  'tasks',
  'habits',
  'calendar',
  'finance',
  'notes',
  'pomodoro',
  'statistics',
  'achievements',
  'backup',
  'settings',
  'notifications',
] as const;

export type Namespace = (typeof NAMESPACES)[number];
