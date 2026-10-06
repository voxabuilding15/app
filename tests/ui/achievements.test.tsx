import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { AchievementsBridge } from '@/features/achievements/presentation/AchievementsBridge';
import { AchievementsScreen } from '@/features/achievements/presentation/screens/AchievementsScreen';

import { createSeeder } from '../support/seed';

import { createApp, renderWithApp, router } from './harness';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 400, height: 800, scale: 2, fontScale: 1 }),
}));

function app() {
  const created = createApp();
  const seed = createSeeder(created.container.db, () => Date.now());
  return { ...created, seed };
}

/** Finishes tasks today. */
function finishTasks(seed: ReturnType<typeof app>['seed'], count: number) {
  const noon = new Date();
  noon.setHours(0, 0, 5, 0);
  for (let index = 0; index < count; index += 1) {
    seed.addTask(`t${index}`, { createdAt: noon.getTime(), completedAt: noon.getTime() + index });
  }
}

describe('AchievementsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts a new person at level 1 with this week and month to play for', async () => {
    await renderWithApp(<AchievementsScreen />);
    expect(await screen.findByText('Beginner')).toBeTruthy();
    expect(screen.getByLabelText(/^Level 1, Beginner, 0 XP/)).toBeTruthy();
    expect(screen.getByLabelText(/^Daily streak: 0 days/)).toBeTruthy();
    expect(screen.getByText('Weekly challenges')).toBeTruthy();
    expect(screen.getByText('Monthly challenges')).toBeTruthy();
    expect(screen.getAllByLabelText(/^.+\. 0 of \d+\. \+\d+ XP$/)).toHaveLength(5);
  });

  it('shows earned XP, the level progress and the badges that were unlocked', async () => {
    const created = app();
    const { seed } = created;
    finishTasks(seed, 10);
    await renderWithApp(<AchievementsScreen />, created);
    // 10 tasks: 100 XP of work, 20 for the first task, 25 for the first milestone.
    expect(await screen.findByLabelText(/^Level 2, Beginner, 145 XP/)).toBeTruthy();
    expect(screen.getByText('145 XP')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Badges'));
    const first = await screen.findByLabelText(/^First task done\./);
    expect(first.props.accessibilityLabel).toMatch(/Unlocked/);
    expect(screen.getByLabelText(/^First note\. .*Locked/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Milestones'));
    const bronze = await screen.findByLabelText(/^Task finisher\. Complete 10 tasks\. Unlocked/);
    expect(bronze).toBeTruthy();
    expect(
      screen.getByLabelText(/^Task finisher\. Complete 50 tasks\. Locked, 10 of 50/),
    ).toBeTruthy();
    expect(screen.getByLabelText(/^3-day streak\./)).toBeTruthy();
  });

  it('links to the statistics', async () => {
    await renderWithApp(<AchievementsScreen />);
    await fireEvent.press(await screen.findByLabelText('Open statistics'));
    expect(router.navigate).toHaveBeenCalledWith('/statistics');
  });
});

describe('unlock celebration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('celebrates a new achievement and remembers that it was shown', async () => {
    const created = app();
    const { seed } = created;
    finishTasks(seed, 1);
    await renderWithApp(<AchievementsBridge />, created);

    expect(await screen.findByText('First task done')).toBeTruthy();
    expect(screen.getByText('+20 XP')).toBeTruthy();
    expect(screen.getAllByText('Unlocked').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByLabelText('Nice!'));
    await waitFor(() => expect(screen.queryByText('First task done')).toBeNull());
    expect((await created.achievements.sync()).unseen).toHaveLength(0);
  });

  it('shows several unlocks one after another', async () => {
    const created = app();
    const { seed } = created;
    finishTasks(seed, 10);
    await renderWithApp(<AchievementsBridge />, created);

    expect(await screen.findByText('1 more to see')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Next'));
    await waitFor(() => expect(screen.getByLabelText('Nice!')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Nice!'));
    await waitFor(() => expect(screen.queryByLabelText('Nice!')).toBeNull());
  });

  it('opens the achievements and clears the queue from the celebration', async () => {
    const created = app();
    const { seed } = created;
    finishTasks(seed, 10);
    await renderWithApp(<AchievementsBridge />, created);
    await fireEvent.press(await screen.findByLabelText('See all achievements'));
    expect(router.navigate).toHaveBeenCalledWith('/achievements');
    await waitFor(() => expect(screen.queryByLabelText('See all achievements')).toBeNull());
    expect((await created.achievements.sync()).unseen).toHaveLength(0);
  });

  it('notices work done elsewhere in the app a moment after it was saved', async () => {
    const created = app();
    const { seed } = created;
    await renderWithApp(<AchievementsBridge />, created);
    await act(async () => undefined);
    expect(screen.queryByText('First task done')).toBeNull();

    // A tasks screen being open keeps a query alive, which is what the bridge listens to.
    await created.client.prefetchQuery({
      queryKey: ['tasks', 'list'],
      queryFn: () => [],
      gcTime: Infinity,
    });
    finishTasks(seed, 1);
    await act(async () => {
      await created.client.invalidateQueries({ queryKey: ['tasks'] });
    });
    expect(await screen.findByText('First task done', {}, { timeout: 4000 })).toBeTruthy();
  });

  it('ignores changes in places that cannot earn anything', async () => {
    const created = app();
    const { seed } = created;
    await renderWithApp(<AchievementsBridge />, created);
    await act(async () => undefined);
    finishTasks(seed, 1);
    await act(async () => {
      await created.client.prefetchQuery({
        queryKey: ['settings', 'x'],
        queryFn: () => [],
        gcTime: Infinity,
      });
      await created.client.invalidateQueries({ queryKey: ['settings'] });
      await new Promise((resolve) => setTimeout(resolve, 1500));
    });
    expect(screen.queryByText('First task done')).toBeNull();
  });

  it('skips the animation for people who prefer reduced motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);
    const created = app();
    const { seed } = created;
    finishTasks(seed, 1);
    await renderWithApp(<AchievementsBridge />, created);
    expect(await screen.findByText('First task done')).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Unlocked: First task done. +20 XP');
  });
});
