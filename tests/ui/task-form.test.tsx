import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { DEFAULT_FILTER, defaultSortFor } from '@/features/tasks/domain/filters';
import { emptyDraft } from '@/features/tasks/domain/validation';
import { TaskFormScreen } from '@/features/tasks/presentation/screens/TaskFormScreen';

import { createApp, renderWithApp, router, type TestApp } from './harness';

const openPicker = DateTimePickerAndroid.open as jest.Mock;

function pickerReturns(date: Date) {
  openPicker.mockImplementation(({ onChange }: { onChange: (e: object, d?: Date) => void }) =>
    onChange({ type: 'set' }, date),
  );
}

const all = (app: TestApp) => app.tasks.tasks.list(DEFAULT_FILTER, defaultSortFor('active'), 50);

describe('TaskFormScreen (create)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('blocks saving without a title and explains why', async () => {
    const app = await renderWithApp(<TaskFormScreen taskId={null} />);
    await fireEvent.press(screen.getByLabelText('Create task'));
    expect(await screen.findByText('Enter a title')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
    expect(await all(app)).toHaveLength(0);

    await fireEvent.changeText(screen.getByLabelText('Title'), 'Now valid');
    await waitFor(() => expect(screen.queryByText('Enter a title')).toBeNull());
  });

  it('creates a fully specified task and schedules its reminder', async () => {
    pickerReturns(new Date(2030, 0, 15, 14, 30));
    const app = await renderWithApp(<TaskFormScreen taskId={null} />);

    await fireEvent.changeText(screen.getByLabelText('Title'), 'Submit taxes');
    await fireEvent.changeText(screen.getByLabelText('Notes'), 'Use the new forms');
    await fireEvent.changeText(screen.getByPlaceholderText('Add a subtask'), 'Gather receipts');
    const addButtons = screen.getAllByLabelText('Add subtask');
    await fireEvent.press(addButtons[addButtons.length - 1]!);
    expect(await screen.findByDisplayValue('Gather receipts')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('High'));
    await fireEvent.press(screen.getByLabelText('Pick date'));
    await fireEvent.press(await screen.findByLabelText('Add due time'));
    await fireEvent.press(await screen.findByLabelText('15 min before'));
    await fireEvent(screen.getByLabelText('Ring as an alarm'), 'valueChange', true);
    await fireEvent.press(screen.getByLabelText('Weekly'));

    await fireEvent.press(screen.getByLabelText('Create a category'));
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Finance');
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(screen.queryByLabelText('Name')).toBeNull());

    await fireEvent.press(screen.getByLabelText('Create task'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());

    const [task] = await all(app);
    expect(task).toMatchObject({
      title: 'Submit taxes',
      notes: 'Use the new forms',
      priority: 'high',
      isAlarm: true,
      reminderOffsetMinutes: 15,
      repeat: { unit: 'week', interval: 1, weekdays: 0 },
      subtaskTotal: 1,
    });
    expect(task?.category?.name).toBe('Finance');
    expect(task?.due).toEqual({ at: new Date(2030, 0, 15, 14, 30).getTime(), hasTime: true });
    expect(task?.reminderAt).toBe(new Date(2030, 0, 15, 14, 15).getTime());
    expect(app.notifications.scheduled).toEqual(['Submit taxes']);
  });

  it('offers all-day reminder options after the time is removed', async () => {
    pickerReturns(new Date(2030, 0, 15, 14, 30));
    await renderWithApp(<TaskFormScreen taskId={null} />);
    await fireEvent.press(screen.getByLabelText('Today'));
    await fireEvent.press(await screen.findByLabelText('Add due time'));
    expect(await screen.findByLabelText('15 min before')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('15 min before'));

    await fireEvent.press(screen.getByLabelText('Remove time'));
    expect(await screen.findByLabelText('On the day, 9:00')).toBeTruthy();
    expect(screen.queryByLabelText('15 min before')).toBeNull();
  });

  it('only offers reminder and repeat once a due date exists, and clears them with it', async () => {
    await renderWithApp(<TaskFormScreen taskId={null} />);
    expect(screen.queryByText('Reminder')).toBeNull();
    expect(screen.queryByText('Repeat')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Tomorrow'));
    expect(await screen.findByText('Reminder')).toBeTruthy();
    expect(screen.getByText('Repeat')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Remove due date'));
    await waitFor(() => expect(screen.queryByText('Reminder')).toBeNull());
  });

  it('configures a custom repeat on chosen weekdays', async () => {
    const app = await renderWithApp(<TaskFormScreen taskId={null} />);
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Gym');
    await fireEvent.press(screen.getByLabelText('Tomorrow'));
    await fireEvent.press(await screen.findByLabelText('Custom'));
    await fireEvent.press(await screen.findByLabelText('Weeks'));
    await fireEvent.changeText(screen.getByLabelText('Every'), '2');
    await fireEvent.press(await screen.findByLabelText('Mon'));
    await fireEvent.press(screen.getByLabelText('Wed'));
    expect(await screen.findByText(/Every 2 weeks on Mon, Wed/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Create task'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const [task] = await all(app);
    expect(task?.repeat).toEqual({ unit: 'week', interval: 2, weekdays: 0b0001010 });
  });

  it('rejects a duplicate category name inline', async () => {
    const app = await renderWithApp(<TaskFormScreen taskId={null} />);
    await app.tasks.taxonomy.saveCategory({ id: null, name: 'Work', color: '#000' });
    await fireEvent.press(await screen.findByLabelText('Create a category'));
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'work');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('This name is already in use')).toBeTruthy();
  });
});

describe('TaskFormScreen (edit)', () => {
  beforeEach(() => jest.clearAllMocks());

  async function seeded(overrides: Partial<ReturnType<typeof emptyDraft>> = {}) {
    const app = createApp();
    const saved = await app.tasks.tasks.save(
      {
        ...emptyDraft(),
        title: 'Original',
        notes: 'Some notes',
        priority: 'low',
        subtasks: [{ id: null, title: 'Step one', completed: true }],
        ...overrides,
      },
      null,
    );
    if (!saved.ok) {
      throw new Error('seed failed');
    }
    return { app, id: saved.id };
  }

  it('loads the saved values into the form', async () => {
    const { app, id } = await seeded();
    await renderWithApp(<TaskFormScreen taskId={id} />, app);
    expect(await screen.findByDisplayValue('Original')).toBeTruthy();
    expect(screen.getByDisplayValue('Some notes')).toBeTruthy();
    expect(screen.getByDisplayValue('Step one')).toBeTruthy();
    expect(screen.getByLabelText('Low').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Save changes')).toBeTruthy();
  });

  it('saves edits while preserving existing subtask identity', async () => {
    const { app, id } = await seeded();
    const before = await app.tasks.tasks.get(id);
    await renderWithApp(<TaskFormScreen taskId={id} />, app);

    await fireEvent.changeText(await screen.findByLabelText('Title'), 'Renamed');
    await fireEvent.changeText(screen.getByPlaceholderText('Add a subtask'), 'Step two');
    const adds = screen.getAllByLabelText('Add subtask');
    await fireEvent.press(adds[adds.length - 1]!);
    await fireEvent.press(screen.getByLabelText('High'));
    await fireEvent.press(screen.getByLabelText('Save changes'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());

    const after = await app.tasks.tasks.get(id);
    expect(after?.title).toBe('Renamed');
    expect(after?.priority).toBe('high');
    expect(after?.subtasks.map((s) => s.title)).toEqual(['Step one', 'Step two']);
    expect(after?.subtasks[0]?.id).toBe(before?.subtasks[0]?.id);
    expect(after?.subtasks[0]?.completed).toBe(true);
    expect(after?.createdAt).toBe(before?.createdAt);
  });

  it('removes a subtask', async () => {
    const { app, id } = await seeded();
    await renderWithApp(<TaskFormScreen taskId={id} />, app);
    await fireEvent.press(await screen.findByLabelText('Remove subtask 1'));
    await fireEvent.press(screen.getByLabelText('Save changes'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await app.tasks.tasks.get(id))?.subtasks).toHaveLength(0);
  });

  it('archives from the header and leaves the screen', async () => {
    const { app, id } = await seeded();
    await renderWithApp(<TaskFormScreen taskId={id} />, app);
    await fireEvent.press(await screen.findByLabelText('Archive task'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await app.tasks.tasks.get(id))?.archivedAt).not.toBeNull();
  });

  it('deletes only after confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { app, id } = await seeded();
    await renderWithApp(<TaskFormScreen taskId={id} />, app);

    await fireEvent.press(await screen.findByLabelText('Delete task'));
    expect(alert).toHaveBeenCalledWith(
      'Delete this task?',
      expect.stringContaining('permanently'),
      expect.any(Array),
    );
    expect(await app.tasks.tasks.get(id)).not.toBeNull();

    const buttons = alert.mock.calls[0]?.[2] ?? [];
    await act(async () => buttons.find((b) => b.style === 'destructive')?.onPress?.());
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await app.tasks.tasks.get(id)).toBeNull();
  });

  it('explains when the task no longer exists', async () => {
    await renderWithApp(<TaskFormScreen taskId="missing" />);
    expect(await screen.findByText('Task not found')).toBeTruthy();
  });

  it('tells the user when a task is archived', async () => {
    const { app, id } = await seeded();
    await act(async () => {
      await app.tasks.tasks.archive([id]);
    });
    await renderWithApp(<TaskFormScreen taskId={id} />, app);
    expect(await screen.findByText('This task is archived.')).toBeTruthy();
  });

  it('warns when notifications are blocked but still saves the task', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const app = createApp();
    app.notifications.getPermissionState = async () => 'denied';
    pickerReturns(new Date(2030, 0, 15, 9, 0));
    await renderWithApp(<TaskFormScreen taskId={null} />, app);

    await fireEvent.changeText(screen.getByLabelText('Title'), 'Reminder me');
    await fireEvent.press(screen.getByLabelText('Pick date'));
    await fireEvent.press(await screen.findByLabelText('Add due time'));
    await fireEvent.press(await screen.findByLabelText('At due time'));
    await fireEvent.press(screen.getByLabelText('Create task'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(alert).toHaveBeenCalledWith('Reminder will not fire', expect.any(String));
    expect(await all(app)).toHaveLength(1);
    expect(app.notifications.scheduled).toHaveLength(0);
  });
});
