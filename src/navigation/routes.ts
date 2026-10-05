import type { IconName } from '@/components';

export interface NavItem {
  name: string;
  title: string;
  icon: IconName;
}

export const TABS_ROUTE = '(tabs)';

export const HOME_ITEM: NavItem = { name: TABS_ROUTE, title: 'Home', icon: 'home' };

export const TAB_ITEMS: readonly NavItem[] = [
  { name: 'index', title: 'Dashboard', icon: 'dashboard' },
  { name: 'tasks', title: 'Tasks', icon: 'check-circle' },
  { name: 'calendar', title: 'Calendar', icon: 'calendar-month' },
  { name: 'habits', title: 'Habits', icon: 'local-fire-department' },
  { name: 'finance', title: 'Finance', icon: 'account-balance-wallet' },
];

export const DRAWER_ITEMS: readonly NavItem[] = [
  { name: 'notes', title: 'Notes', icon: 'sticky-note-2' },
  { name: 'pomodoro', title: 'Pomodoro', icon: 'timer' },
  { name: 'statistics', title: 'Statistics', icon: 'bar-chart' },
  { name: 'achievements', title: 'Achievements', icon: 'emoji-events' },
  { name: 'settings', title: 'Settings', icon: 'settings' },
];
