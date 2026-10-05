import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { startOfDay } from '@/features/tasks/domain/dates';
import { emptyDraft, type TaskDraft } from '@/features/tasks/domain/validation';
import { TaskListScreen } from '@/features/tasks/presentation/screens/TaskListScreen';

import { renderWithApp, router } from './harness';

type Harness = Awaited<ReturnType<typeof renderWithApp>>;

async function seed(app: Harness, drafts: Partial<TaskDraft>[]) {
  await act(async () => {
    for (const draft of drafts) {
      await app.tasks.tasks.save({ ...emptyDraft(), title: 'Task', ...draft }, null);
    }
    await app.client.invalidateQueries({ queryKey: ['tasks'] });
  });
}

const row = (title: string) => screen.getByLabelText(new RegExp(`^${title}`));
const gone = (title: string) => waitFor(() => expect(screen.queryByText(title)).toBeNull());

describe('TaskListScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the empty state with working add actions', async () => {
    await renderWithApp(<TaskListScreen />);
    expect(await screen.findByText('No tasks yet')).toBeTruthy();
    const [first] = screen.getAllByLabelText('Add task');
    await fireEvent.press(first!);
    expect(router.push).toHaveBeenCalledWith('/tasks/new');
  });

  it('completes a task from its checkbox and lists it under Done', async () => {
    const app = await renderWithApp(<TaskListScreen />);
    await seed(app, [{ title: 'Write report' }]);
    expect(await screen.findByText('Write report')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Mark Write report as done'));
    await gone('Write report');
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(await screen.findByText('Write report')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Mark Write report as not done'));
    await gone('Write report');
  });

  it('opens a task for editing when pressed', async () => {
    const app = await renderWithApp(<TaskListScreen />);
    await seed(app, [{ title: 'Open me' }]);
    await screen.findByText('Open me');
    await fireEvent.press(row('Open me'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/tasks/[id]',
      params: { id: expect.any(String) },
    });
  });

  it('archives with a swipe action and restores from the Archived tab', async () => {
    const app = await renderWithApp(<TaskListScreen />);
    await seed(app, [{ title: 'Old stuff' }]);
    await screen.findByText('Old stuff');

    await fireEvent.press(screen.getByLabelText('Archive'));
    await gone('Old stuff');
    expect(await screen.findByText('Task archived')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Archived'));
    expect(await screen.findByText('Old stuff')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Restore'));
    await gone('Old stuff');
    await fireEvent.press(screen.getByLabelText('Active'));
    expect(await screen.findByText('Old stuff')).toBeTruthy();
  });

  it('deletes with a swipe action and undoes the delete', async () => {
    const app = await renderWithApp(<TaskListScreen />);
    await seed(app, [{ title: 'Oops' }]);
    await screen.findByText('Oops');

    await fireEvent.press(screen.getByLabelText('Delete'));
    await gone('Oops');
    expect(await screen.findByText('Task deleted')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Undo'));
    expect(await screen.findByText('Oops')).toBeTruthy();
  });

  it('supports multi-select with bulk archive and bulk delete plus undo', async () => {
    const app = await renderWithApp(<TaskListScreen />);
    await seed(app, [{ title: 'Alpha' }, { title: 'Beta' }, { title: 'Gamma' }]);
    await screen.findByText('Gamma');

    await fireEvent(row('Alpha'), 'longPress');
    expect(await screen.findByText('1 selected')).toBeTruthy();
    await fireEvent.press(row('Beta'));
    expect(await screen.findByText('2 selected')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Archive selected'));
    await gone('Alpha');
    expect(await screen.findByText('2 tasks archived')).toBeTruthy();
    expect(screen.getByText('Gamma')).toBeTruthy();
    expect(screen.queryByText(/selected/)).toBeNull();

    await fireEvent.press(screen.getByLabelText('Select tasks'));
    await fireEvent.press(screen.getByLabelText('Select all'));
    expect(await screen.findByText('1 selected')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Delete selected'));
    await gone('Gamma');
    await fireEvent.press(await screen.findByLabelText('Undo'));
    expect(await screen.findByText('Gamma')).toBeTruthy();
  });

  it('exits selection when the last selected task is deselected', async () => {
    const app = await renderWithApp(<TaskListScreen />);
    await seed(app, [{ title: 'Solo' }]);
    await screen.findByText('Solo');
    await fireEvent(row('Solo'), 'longPress');
    await screen.findByText('1 selected');
    await fireEvent.press(row('Solo'));
    await waitFor(() => expect(screen.queryByText(/selected/)).toBeNull());
  });

  it('searches titles, notes and subtasks, and recovers from no results', async () => {
    const app = await renderWithApp(<TaskListScreen />);
    await seed(app, [
      { title: 'Buy milk' },
      { title: 'Plan trip', notes: 'book flights' },
      { title: 'Chores', subtasks: [{ id: null, title: 'Vacuum', completed: false }] },
    ]);
    await screen.findByText('Buy milk');

    await fireEvent.press(screen.getByLabelText('Search tasks'));
    await fireEvent.changeText(screen.getByPlaceholderText('Title, notes or subtasks'), 'flights');
    await gone('Buy milk');
    expect(screen.getByText('Plan trip')).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText('Title, notes or subtasks'), 'vacuum');
    expect(await screen.findByText('Chores')).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText('Title, notes or subtasks'), 'zzz');
    expect(await screen.findByText('No matching tasks')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Clear search and filters'));
    expect(await screen.findByText('Buy milk')).toBeTruthy();
  });

  it('filters by priority and category from the filter sheet', async () => {
    const app = await renderWithApp(<TaskListScreen />);
    const category = await app.tasks.taxonomy.saveCategory({
      id: null,
      name: 'Home',
      color: '#000',
    });
    if (!category.ok) {
      throw new Error('category not saved');
    }
    await seed(app, [
      { title: 'Urgent thing', priority: 'high' },
      { title: 'Easy thing', priority: 'low', categoryId: category.id },
    ]);
    await screen.findByText('Urgent thing');

    await fireEvent.press(screen.getByLabelText('Filter'));
    const sheet = screen;
    await fireEvent.press(sheet.getByLabelText('High'));
    await gone('Easy thing');
    expect(screen.getByText('Urgent thing')).toBeTruthy();

    await fireEvent.press(sheet.getByLabelText('Reset'));
    expect(await screen.findByText('Easy thing')).toBeTruthy();
    await fireEvent.press(sheet.getByLabelText('Home'));
    await gone('Urgent thing');
    expect(screen.getByText('Easy thing')).toBeTruthy();
  });

  it('sorts by priority and reverses the direction', async () => {
    const app = await renderWithApp(<TaskListScreen />);
    await seed(app, [
      { title: 'Low one', priority: 'low' },
      { title: 'High one', priority: 'high' },
    ]);
    await screen.findByText('Low one');

    await fireEvent.press(screen.getByLabelText(/^Sort by Due date/));
    await fireEvent.press(await screen.findByLabelText('Priority'));
    await fireEvent.press(screen.getByLabelText('Descending'));
    await waitFor(() => {
      const titles = screen
        .getAllByLabelText(/priority/)
        .map((node) => node.props.accessibilityLabel as string);
      expect(titles[0]).toMatch(/^High one/);
    });
  });

  it('shows today progress and an overdue shortcut', async () => {
    const app = await renderWithApp(<TaskListScreen />);
    const today = startOfDay(Date.now());
    await seed(app, [
      { title: 'Due today', due: { at: today, hasTime: false } },
      { title: 'Late', due: { at: today - 2 * 86_400_000, hasTime: false } },
    ]);
    expect(await screen.findByText('0 of 1 due today done')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('1 overdue'));
    await gone('Due today');
    expect(screen.getByText('Late')).toBeTruthy();
  });

  it('completing a repeating task shows the next occurrence', async () => {
    const app = await renderWithApp(<TaskListScreen />);
    const today = startOfDay(Date.now());
    await seed(app, [
      {
        title: 'Water plants',
        due: { at: today, hasTime: false },
        repeat: { unit: 'day', interval: 1, weekdays: 0 },
      },
    ]);
    await screen.findByText('Water plants');
    await fireEvent.press(screen.getByLabelText('Mark Water plants as done'));
    await waitFor(() => expect(screen.getByText('Tomorrow')).toBeTruthy());
    expect(screen.getByText('Water plants')).toBeTruthy();
  });
});
