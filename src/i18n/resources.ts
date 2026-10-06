import en_common from './locales/en/common.json';
import en_navigation from './locales/en/navigation.json';
import en_dashboard from './locales/en/dashboard.json';
import en_tasks from './locales/en/tasks.json';
import en_habits from './locales/en/habits.json';
import en_calendar from './locales/en/calendar.json';
import en_finance from './locales/en/finance.json';
import en_notes from './locales/en/notes.json';
import en_pomodoro from './locales/en/pomodoro.json';
import en_statistics from './locales/en/statistics.json';
import en_achievements from './locales/en/achievements.json';
import en_backup from './locales/en/backup.json';
import en_settings from './locales/en/settings.json';
import en_notifications from './locales/en/notifications.json';
import fr_common from './locales/fr/common.json';
import fr_navigation from './locales/fr/navigation.json';
import fr_dashboard from './locales/fr/dashboard.json';
import fr_tasks from './locales/fr/tasks.json';
import fr_habits from './locales/fr/habits.json';
import fr_calendar from './locales/fr/calendar.json';
import fr_finance from './locales/fr/finance.json';
import fr_notes from './locales/fr/notes.json';
import fr_pomodoro from './locales/fr/pomodoro.json';
import fr_statistics from './locales/fr/statistics.json';
import fr_achievements from './locales/fr/achievements.json';
import fr_backup from './locales/fr/backup.json';
import fr_settings from './locales/fr/settings.json';
import fr_notifications from './locales/fr/notifications.json';
import ar_common from './locales/ar/common.json';
import ar_navigation from './locales/ar/navigation.json';
import ar_dashboard from './locales/ar/dashboard.json';
import ar_tasks from './locales/ar/tasks.json';
import ar_habits from './locales/ar/habits.json';
import ar_calendar from './locales/ar/calendar.json';
import ar_finance from './locales/ar/finance.json';
import ar_notes from './locales/ar/notes.json';
import ar_pomodoro from './locales/ar/pomodoro.json';
import ar_statistics from './locales/ar/statistics.json';
import ar_achievements from './locales/ar/achievements.json';
import ar_backup from './locales/ar/backup.json';
import ar_settings from './locales/ar/settings.json';
import ar_notifications from './locales/ar/notifications.json';

import type { LanguageCode } from './languages';
import type { Namespace } from './namespaces';

type Resources = Record<LanguageCode, Record<Namespace, Record<string, string>>>;

/** Every translation, bundled with the app so the interface is translated offline and instantly. */
export const resources: Resources = {
  en: {
    common: en_common,
    navigation: en_navigation,
    dashboard: en_dashboard,
    tasks: en_tasks,
    habits: en_habits,
    calendar: en_calendar,
    finance: en_finance,
    notes: en_notes,
    pomodoro: en_pomodoro,
    statistics: en_statistics,
    achievements: en_achievements,
    backup: en_backup,
    settings: en_settings,
    notifications: en_notifications,
  },
  fr: {
    common: fr_common,
    navigation: fr_navigation,
    dashboard: fr_dashboard,
    tasks: fr_tasks,
    habits: fr_habits,
    calendar: fr_calendar,
    finance: fr_finance,
    notes: fr_notes,
    pomodoro: fr_pomodoro,
    statistics: fr_statistics,
    achievements: fr_achievements,
    backup: fr_backup,
    settings: fr_settings,
    notifications: fr_notifications,
  },
  ar: {
    common: ar_common,
    navigation: ar_navigation,
    dashboard: ar_dashboard,
    tasks: ar_tasks,
    habits: ar_habits,
    calendar: ar_calendar,
    finance: ar_finance,
    notes: ar_notes,
    pomodoro: ar_pomodoro,
    statistics: ar_statistics,
    achievements: ar_achievements,
    backup: ar_backup,
    settings: ar_settings,
    notifications: ar_notifications,
  },
};
