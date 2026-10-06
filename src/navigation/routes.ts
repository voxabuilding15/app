import type { IconName } from '@/components';

export interface NavItem {
  name: string;
  title: string;
  icon: IconName;
  /** The route renders its own header (e.g. a nested stack), so the tab header is hidden. */
  ownHeader?: boolean;
}

export const TABS_ROUTE = '(tabs)';

export const HOME_ITEM: NavItem = { name: TABS_ROUTE, title: 'Home', icon: 'home' };

export const TAB_ITEMS: readonly NavItem[] = [
  { name: 'index', title: 'Dashboard', icon: 'dashboard' },
  { name: 'tasks', title: 'Tasks', icon: 'check-circle', ownHeader: true },
  { name: 'calendar', title: 'Calendar', icon: 'calendar-month', ownHeader: true },
  { name: 'habits', title: 'Habits', icon: 'local-fire-department', ownHeader: true },
  { name: 'finance', title: 'Finance', icon: 'account-balance-wallet', ownHeader: true },
];

export const DRAWER_ITEMS: readonly NavItem[] = [
  { name: 'notes', title: 'Notes', icon: 'sticky-note-2', ownHeader: true },
  { name: 'pomodoro', title: 'Pomodoro', icon: 'timer', ownHeader: true },
  { name: 'statistics', title: 'Statistics', icon: 'bar-chart', ownHeader: true },
  { name: 'achievements', title: 'Achievements', icon: 'emoji-events', ownHeader: true },
  { name: 'settings', title: 'Settings', icon: 'settings' },
];
