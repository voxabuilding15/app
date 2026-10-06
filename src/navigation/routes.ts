import type { IconName } from '@/components';
import { msg } from '@/i18n/msg';

export interface NavItem {
  name: string;
  title: string;
  icon: IconName;
  /** The route renders its own header (e.g. a nested stack), so the tab header is hidden. */
  ownHeader?: boolean;
}

export const TABS_ROUTE = '(tabs)';

export const HOME_ITEM: NavItem = { name: TABS_ROUTE, title: msg('Home'), icon: 'home' };

export const TAB_ITEMS: readonly NavItem[] = [
  { name: 'index', title: msg('Dashboard'), icon: 'dashboard' },
  { name: 'tasks', title: msg('Tasks'), icon: 'check-circle', ownHeader: true },
  { name: 'calendar', title: msg('Calendar'), icon: 'calendar-month', ownHeader: true },
  { name: 'habits', title: msg('Habits'), icon: 'local-fire-department', ownHeader: true },
  { name: 'finance', title: msg('Finance'), icon: 'account-balance-wallet', ownHeader: true },
];

export const DRAWER_ITEMS: readonly NavItem[] = [
  { name: 'notes', title: msg('Notes'), icon: 'sticky-note-2', ownHeader: true },
  { name: 'pomodoro', title: msg('Pomodoro'), icon: 'timer', ownHeader: true },
  { name: 'statistics', title: msg('Statistics'), icon: 'bar-chart', ownHeader: true },
  { name: 'achievements', title: msg('Achievements'), icon: 'emoji-events', ownHeader: true },
  { name: 'settings', title: msg('Settings'), icon: 'settings', ownHeader: true },
];
