import type { ReactElement } from 'react';
import { screen } from '@testing-library/react-native';

import { AchievementsScreen } from '@/features/achievements/presentation/screens/AchievementsScreen';
import { BackupScreen } from '@/features/backup/presentation/screens/BackupScreen';
import { CalendarScreen } from '@/features/calendar';
import { DashboardScreen } from '@/features/dashboard';
import { FinanceScreen } from '@/features/finance';
import { HabitFormScreen, HabitListScreen } from '@/features/habits';
import { NoteEditorScreen, NotesScreen } from '@/features/notes';
import { PomodoroScreen } from '@/features/pomodoro/presentation/screens/PomodoroScreen';
import { SettingsScreen as PomodoroSettingsScreen } from '@/features/pomodoro/presentation/screens/SettingsScreen';
import { FeedbackScreen } from '@/features/settings/presentation/screens/FeedbackScreen';
import { SecurityScreen } from '@/features/settings/presentation/screens/SecurityScreen';
import { SettingsScreen } from '@/features/settings/presentation/screens/SettingsScreen';
import { StatisticsScreen } from '@/features/statistics/presentation/screens/StatisticsScreen';
import { TaskFormScreen, TaskListScreen } from '@/features/tasks';
import { syncLanguage } from '@/i18n/bootstrap';
import type { LanguageCode } from '@/i18n/languages';
import { resources } from '@/i18n/resources';
import { useLanguageStore } from '@/i18n/store';

import { createSeeder } from '../support/seed';

import { createApp, renderWithApp } from './harness';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 400, height: 800, scale: 2, fontScale: 1 }),
}));

function populated() {
  const app = createApp();
  const seed = createSeeder(app.container.db, () => Date.now());
  const start = new Date();
  start.setHours(0, 0, 5, 0);
  const at = start.getTime();
  seed.addTask('Write report', { createdAt: at, dueAt: at + 3_600_000 });
  seed.addTask('Done thing', { createdAt: at, completedAt: at + 1000 });
  seed.addHabit('Read', '2026-01-01', [{ date: '2026-10-01' }]);
  seed.addEvent('Dentist', at + 7_200_000, at + 10_800_000);
  seed.addTransaction('expense', 4_250, at);
  seed.addNote('Plan', at);
  return app;
}

const SCREENS: readonly [string, () => ReactElement][] = [
  ['Dashboard', () => <DashboardScreen />],
  ['Tasks', () => <TaskListScreen />],
  ['New task', () => <TaskFormScreen taskId={null} />],
  ['Habits', () => <HabitListScreen />],
  ['New habit', () => <HabitFormScreen habitId={null} />],
  ['Calendar', () => <CalendarScreen />],
  ['Finance', () => <FinanceScreen />],
  ['Notes', () => <NotesScreen />],
  ['New note', () => <NoteEditorScreen noteId={null} defaults={{ folderId: null }} />],
  ['Pomodoro', () => <PomodoroScreen />],
  ['Pomodoro settings', () => <PomodoroSettingsScreen />],
  ['Statistics', () => <StatisticsScreen />],
  ['Achievements', () => <AchievementsScreen />],
  ['Settings', () => <SettingsScreen />],
  ['Security', () => <SecurityScreen />],
  ['Backup', () => <BackupScreen />],
  ['Feedback', () => <FeedbackScreen />],
];

interface TreeNode {
  props?: Record<string, unknown>;
  children?: (TreeNode | string)[] | null;
}

/** Every piece of text a person (or a screen reader) gets from the screen. */
function shownText(): string[] {
  const found: string[] = [];
  const visit = (node: TreeNode | string | null) => {
    if (node === null) {
      return;
    }
    if (typeof node === 'string') {
      found.push(node.trim());
      return;
    }
    for (const key of ['accessibilityLabel', 'accessibilityHint', 'placeholder', 'title']) {
      const value = node.props?.[key];
      if (typeof value === 'string') {
        found.push(value.trim());
      }
    }
    node.children?.forEach(visit);
  };
  const tree = screen.toJSON() as TreeNode | TreeNode[] | null;
  (Array.isArray(tree) ? tree : [tree]).forEach(visit);
  return found.filter((text) => text !== '');
}

/** English phrases that have a different text in `language`, and so must not show up as written. */
function translatable(language: LanguageCode): Set<string> {
  const phrases = new Set<string>();
  for (const [namespace, english] of Object.entries(resources.en)) {
    const translated =
      (resources[language] as Record<string, Record<string, string>>)[namespace] ?? {};
    for (const [key, text] of Object.entries(english)) {
      if (!/_(zero|one|two|few|many|other)$/.test(key) && translated[key] !== text) {
        phrases.add(text);
      }
    }
  }
  return phrases;
}

afterEach(() => {
  useLanguageStore.setState({ preference: 'system' });
  syncLanguage();
});

describe.each(['fr', 'ar'] as const)('every screen in %s', (language) => {
  it.each(SCREENS)('%s shows no English where a translation exists', async (_name, build) => {
    useLanguageStore.setState({ preference: language });
    const english = translatable(language);
    await renderWithApp(build(), populated());
    await new Promise((resolve) => setTimeout(resolve, 60));
    const leaks = [...new Set(shownText().filter((text) => english.has(text)))];
    expect(leaks).toEqual([]);
  });
});
