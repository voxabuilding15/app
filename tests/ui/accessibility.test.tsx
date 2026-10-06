import type { ReactElement } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';

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

import { createSeeder } from '../support/seed';

import { accessibilityIssues } from './a11y';
import { createApp, renderWithApp } from './harness';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 400, height: 800, scale: 2, fontScale: 1 }),
}));

/** An app with something in every part, so lists and cards actually render. */
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
  return { app, seed, at };
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

describe('the audit itself', () => {
  it('finds controls without a name, fields without a label and unreachable controls', async () => {
    await render(
      <View>
        <Pressable accessibilityRole="button" />
        <Pressable accessibilityRole="button" accessibilityLabel="  " />
        <Pressable
          accessibilityRole="button"
          accessible={false}
          accessibilityLabel="Hidden from reach"
        />
        <TextInput />
      </View>,
    );
    expect(accessibilityIssues()).toEqual([
      'button without a name',
      'button without a name',
      'button "Hidden from reach" cannot be reached',
      'text field without a label',
    ]);
  });

  it('accepts a name from a label or from text, and skips what screen readers skip', async () => {
    await render(
      <View>
        <Pressable accessibilityRole="button" accessibilityLabel="Save" />
        <Pressable accessibilityRole="button">
          <Text>Cancel</Text>
        </Pressable>
        <TextInput accessibilityLabel="Name" />
        <View importantForAccessibility="no-hide-descendants">
          <Pressable accessibilityRole="button" />
        </View>
      </View>,
    );
    expect(accessibilityIssues()).toEqual([]);
  });
});

describe('accessibility audit', () => {
  it.each(SCREENS)('%s: every control has a name and can be reached', async (_name, build) => {
    const { app } = populated();
    await renderWithApp(build(), app);
    // Let the screen load its data before looking.
    await screen.findAllByRole('button').catch(() => []);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(accessibilityIssues()).toEqual([]);
  });
});
