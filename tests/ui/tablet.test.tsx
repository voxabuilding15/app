import { act, screen } from '@testing-library/react-native';

import { emptyHabitDraft } from '@/features/habits/domain/validation';
import { HabitDetailScreen } from '@/features/habits/presentation/screens/HabitDetailScreen';
import { HabitFormScreen } from '@/features/habits/presentation/screens/HabitFormScreen';
import { HabitListScreen } from '@/features/habits/presentation/screens/HabitListScreen';
import { emptyDraft } from '@/features/tasks/domain/validation';
import { TaskFormScreen } from '@/features/tasks/presentation/screens/TaskFormScreen';
import { TaskListScreen } from '@/features/tasks/presentation/screens/TaskListScreen';

import { createApp, renderWithApp } from './harness';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 1100, height: 800, scale: 2, fontScale: 1 }),
}));

type Json = ReturnType<typeof screen.toJSON>;

function styleOf(node: unknown): Record<string, unknown> {
  const style = (node as { props?: { style?: unknown } }).props?.style;
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

function countNodes(tree: Json, predicate: (node: unknown) => boolean): number {
  const nodes = Array.isArray(tree) ? tree : tree === null ? [] : [tree];
  return nodes.reduce<number>((total, node) => {
    const children = (node as { children?: unknown[] | null }).children ?? [];
    const nested = children.filter((child) => typeof child === 'object') as Json[];
    return total + (predicate(node) ? 1 : 0) + countNodes(nested as unknown as Json, predicate);
  }, 0);
}

describe('tablet layout (1100 x 800)', () => {
  it('lays the task list out in two columns', async () => {
    const app = createApp();
    for (const title of ['One', 'Two', 'Three']) {
      await app.tasks.tasks.save({ ...emptyDraft(), title }, null);
    }
    await renderWithApp(<TaskListScreen />, app);
    expect(await screen.findByText('Three')).toBeTruthy();

    // In two-column mode every row cell is capped at half the row width.
    expect(countNodes(screen.toJSON(), (node) => styleOf(node).maxWidth === '50%')).toBe(3);
  });

  it('renders every form section side by side without losing any', async () => {
    await renderWithApp(<TaskFormScreen taskId={null} />);
    for (const section of ['Details', 'Subtasks', 'Priority', 'Due', 'Category', 'Labels']) {
      expect(await screen.findByText(section)).toBeTruthy();
    }
    expect(screen.getByLabelText('Create task')).toBeTruthy();
  });

  it('stays usable after the list data changes', async () => {
    const app = createApp();
    await renderWithApp(<TaskListScreen />, app);
    await screen.findByText('No tasks yet');
    await act(async () => {
      await app.tasks.tasks.save({ ...emptyDraft(), title: 'Late arrival' }, null);
      await app.client.invalidateQueries({ queryKey: ['tasks'] });
    });
    expect(await screen.findByText('Late arrival')).toBeTruthy();
  });

  it('lays the habit list out in two columns', async () => {
    const app = createApp();
    for (const name of ['Read', 'Run', 'Write']) {
      await app.habits.save({ ...emptyHabitDraft('self-improvement', '#7B2FF7'), name }, null);
    }
    await renderWithApp(<HabitListScreen />, app);
    expect(await screen.findByText('Write')).toBeTruthy();
    expect(countNodes(screen.toJSON(), (node) => styleOf(node).maxWidth === '50%')).toBe(3);
  });

  it('shows the habit form and detail side by side without losing sections', async () => {
    const app = createApp();
    const saved = await app.habits.save(
      { ...emptyHabitDraft('self-improvement', '#7B2FF7'), name: 'Read', notes: 'Fiction' },
      null,
    );
    if (!saved.ok) {
      throw new Error('seed failed');
    }

    const form = await renderWithApp(<HabitFormScreen habitId={null} />, app);
    for (const section of ['Details', 'Look', 'Category', 'Frequency and goal', 'Reminder']) {
      expect(await screen.findByText(section)).toBeTruthy();
    }
    form.unmount();

    await renderWithApp(<HabitDetailScreen habitId={saved.id} />, app);
    for (const section of ['Logged today', 'Notes', 'History', 'Last 7 days']) {
      expect(await screen.findByText(section)).toBeTruthy();
    }
  });
});
