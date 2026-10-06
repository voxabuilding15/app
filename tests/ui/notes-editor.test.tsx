import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { DEFAULT_FILTER, DEFAULT_SORT } from '@/features/notes/domain/filters';
import { NoteEditorScreen } from '@/features/notes/presentation/screens/NoteEditorScreen';

import { createApp, renderWithApp, router, type TestApp } from './harness';
import { addFolder, addNote, addTag } from './notes-seed';

const openPicker = DateTimePickerAndroid.open as jest.Mock;
const audio = jest.requireMock('expo-audio') as {
  __state: { permission: boolean; uri: string | null; durationMillis: number };
  __recorder: { record: jest.Mock; stop: jest.Mock };
};
const sharing = jest.requireMock('expo-sharing') as { shareAsync: jest.Mock };

const NEW = { folderId: null } as const;
const all = (app: TestApp) => app.notes.notes.list(DEFAULT_FILTER, DEFAULT_SORT, 50);
const bodyInput = () => screen.getByLabelText('Note text');

function pickerReturns(date: Date) {
  openPicker.mockImplementation(({ onChange }: { onChange: (e: object, d?: Date) => void }) =>
    onChange({ type: 'set' }, date),
  );
}

function confirmAlerts() {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons
      ?.find((button) => button.style === 'destructive' || button.text === 'Remove')
      ?.onPress?.();
  });
}

async function select(start: number, end: number) {
  await fireEvent(bodyInput(), 'selectionChange', { nativeEvent: { selection: { start, end } } });
}

async function openNew(app: TestApp = createApp()) {
  await renderWithApp(<NoteEditorScreen noteId={null} defaults={NEW} />, app);
  await screen.findByLabelText('Title');
  return app;
}

describe('NoteEditorScreen: writing', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    audio.__state.permission = true;
    audio.__state.uri = 'file:///cache/recording.m4a';
  });

  it('saves a new note and goes back', async () => {
    const app = await openNew();
    await fireEvent.changeText(screen.getByLabelText('Title'), '  Shopping ');
    await fireEvent.changeText(bodyInput(), '- [ ] milk\n- [ ] eggs');
    await fireEvent.press(screen.getByLabelText('Save note'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const [saved] = await all(app);
    expect(saved).toMatchObject({ title: 'Shopping', checklistTotal: 2 });
  });

  it('will not save an empty note and says why', async () => {
    const app = await openNew();
    await fireEvent.press(screen.getByLabelText('Save note'));
    expect(await screen.findByText('Add a title or some text')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
    expect(await all(app)).toHaveLength(0);
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Now valid');
    await waitFor(() => expect(screen.queryByText('Add a title or some text')).toBeNull());
  });

  it('wraps the selected text in bold and removes it again', async () => {
    await openNew();
    await fireEvent.changeText(bodyInput(), 'hello world');
    await select(6, 11);
    await fireEvent.press(screen.getByLabelText('Bold'));
    expect(bodyInput().props.value).toBe('hello **world**');
    await select(8, 13);
    await fireEvent.press(screen.getByLabelText('Bold'));
    expect(bodyInput().props.value).toBe('hello world');
  });

  it('applies the other inline styles, headings and lists', async () => {
    await openNew();
    await fireEvent.changeText(bodyInput(), 'word');
    await select(0, 4);
    await fireEvent.press(screen.getByLabelText('Italic'));
    await select(1, 5);
    await fireEvent.press(screen.getByLabelText('Underline'));
    expect(bodyInput().props.value).toBe('*<u>word</u>*');

    await fireEvent.changeText(bodyInput(), 'Title\nitem');
    await select(0, 0);
    await fireEvent.press(screen.getByLabelText('Heading 1'));
    expect(bodyInput().props.value).toBe('# Title\nitem');
    await select(9, 11);
    await fireEvent.press(screen.getByLabelText('Checklist'));
    expect(bodyInput().props.value).toBe('# Title\n- [ ] item');
    await fireEvent.press(screen.getByLabelText('Bulleted list'));
    expect(bodyInput().props.value).toBe('# Title\n- item');
  });

  it('keeps a list going when Enter is pressed and ends it on an empty item', async () => {
    await openNew();
    await fireEvent.changeText(bodyInput(), '- one');
    await fireEvent.changeText(bodyInput(), '- one\n');
    expect(bodyInput().props.value).toBe('- one\n- ');
    await fireEvent.changeText(bodyInput(), '- one\n- \n');
    expect(bodyInput().props.value).toBe('- one\n');
    await fireEvent.changeText(bodyInput(), 'plain\n');
    expect(bodyInput().props.value).toBe('plain\n');
  });

  it('previews the formatted note and ticks tasks from the preview', async () => {
    const app = await openNew();
    await fireEvent.changeText(screen.getByLabelText('Title'), 'List');
    await fireEvent.changeText(bodyInput(), '# Heading\n**bold** text\n- [ ] buy milk');
    await fireEvent.press(screen.getByLabelText('Preview'));

    expect(screen.queryByLabelText('Note text')).toBeNull();
    expect(screen.getByText('Heading')).toBeTruthy();
    expect(screen.getByText('bold').props.style).toMatchObject({ fontWeight: '700' });
    await fireEvent.press(screen.getByLabelText('buy milk, not done'));
    expect(await screen.findByLabelText('buy milk, done')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Edit'));
    expect(bodyInput().props.value).toContain('- [x] buy milk');
    await fireEvent.press(screen.getByLabelText('Save note'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await all(app))[0]).toMatchObject({ checklistDone: 1, checklistTotal: 1 });
  });

  it('says there is nothing to preview for an empty note', async () => {
    await openNew();
    await fireEvent.press(screen.getByLabelText('Preview'));
    expect(screen.getByText('Nothing to preview yet.')).toBeTruthy();
  });
});

describe('NoteEditorScreen: details', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('files the note in a nested folder', async () => {
    const app = createApp();
    const work = await addFolder(app, 'Work');
    const plans = await addFolder(app, 'Plans', work);
    await openNew(app);
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Q4');
    await fireEvent.press(screen.getByLabelText('Folder No folder. Change'));
    await fireEvent.press(await screen.findByLabelText('Plans'));
    expect(await screen.findByLabelText('Folder Work / Plans. Change')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save note'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await all(app))[0]?.folder).toEqual({ id: plans, name: 'Plans' });
  });

  it('starts in the folder it was opened for', async () => {
    const app = createApp();
    const work = await addFolder(app, 'Work');
    await renderWithApp(<NoteEditorScreen noteId={null} defaults={{ folderId: work }} />, app);
    expect(await screen.findByLabelText('Folder Work. Change')).toBeTruthy();
  });

  it('picks and creates tags, and sets a color', async () => {
    const app = createApp();
    await addTag(app, 'Ideas');
    await openNew(app);
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Tagged');
    await fireEvent.press(await screen.findByLabelText('Ideas'));
    await fireEvent.press(screen.getByLabelText('Create a tag'));
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Fresh');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect((await screen.findByLabelText('Fresh')).props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByLabelText('Color 3 of 8'));
    await fireEvent.press(screen.getByLabelText('Save note'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const [saved] = await all(app);
    expect(saved?.tags.map((tag) => tag.name)).toEqual(['Fresh', 'Ideas']);
    expect(saved?.color).toBe('#0891B2');
  });

  it('removes a color again', async () => {
    const app = createApp();
    const id = await addNote(app, 'Colored', { color: '#7B2FF7' });
    await renderWithApp(<NoteEditorScreen noteId={id} defaults={NEW} />, app);
    await fireEvent.press(await screen.findByLabelText('No color'));
    await fireEvent.press(screen.getByLabelText('Save changes'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await app.notes.notes.get(id))?.color).toBeNull();
  });

  it('sets a reminder, which schedules a notification, and can remove it', async () => {
    const app = createApp();
    await openNew(app);
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Call back');
    const when = new Date();
    when.setDate(when.getDate() + 3);
    when.setHours(0, 0, 0, 0);
    pickerReturns(when);
    await fireEvent.press(screen.getByLabelText('Add reminder'));
    expect(await screen.findByLabelText(/^Time 9:00 AM/)).toBeTruthy();
    pickerReturns(new Date(2000, 0, 1, 17, 30));
    await fireEvent.press(screen.getByLabelText(/^Time 9:00 AM/));
    expect(await screen.findByLabelText(/^Time 5:30 PM/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save note'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const [saved] = await all(app);
    expect(saved?.reminderAt).toBe(
      new Date(when.getFullYear(), when.getMonth(), when.getDate(), 17, 30).getTime(),
    );
    expect(app.container.notifications).toBeTruthy();
    expect((app.container.notifications as unknown as { scheduled: string[] }).scheduled).toContain(
      'Call back',
    );

    jest.clearAllMocks();
    await renderWithApp(<NoteEditorScreen noteId={saved!.id} defaults={NEW} />, app);
    await fireEvent.press(await screen.findByLabelText('Remove date'));
    expect(await screen.findByLabelText('Add reminder')).toBeTruthy();
  });

  it('rejects a reminder in the past', async () => {
    const app = await openNew();
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Late');
    pickerReturns(new Date(2001, 0, 1));
    await fireEvent.press(screen.getByLabelText('Add reminder'));
    await fireEvent.press(screen.getByLabelText('Save note'));
    expect(await screen.findByText('Choose a time in the future')).toBeTruthy();
    expect(await all(app)).toHaveLength(0);
  });

  it('pins and favorites from the header', async () => {
    const app = await openNew();
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Important');
    await fireEvent.press(screen.getByLabelText('Pin note'));
    await fireEvent.press(screen.getByLabelText('Add to favorites'));
    expect(screen.getByLabelText('Unpin note')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save note'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await all(app))[0]).toMatchObject({ pinned: true, favorite: true });
  });

  it('asks to set up a lock before locking a note, then locks it', async () => {
    const app = createApp();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await openNew(app);
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Secret');
    await fireEvent(screen.getByLabelText('Lock this note'), 'valueChange', true);
    expect(alert).toHaveBeenCalledWith(
      'Set up a lock first',
      expect.any(String),
      expect.any(Array),
    );
    alert.mock.calls[0]?.[2]?.find((button) => button.text === 'Set up lock')?.onPress?.();
    expect(router.push).toHaveBeenCalledWith('/notes/lock');

    await app.notes.lock.usePin('1234');
    await fireEvent(screen.getByLabelText('Lock this note'), 'valueChange', true);
    await fireEvent.press(screen.getByLabelText('Save note'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await all(app))[0]?.locked).toBe(true);
  });
});

describe('NoteEditorScreen: existing notes', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('loads a note, saves changes and goes back', async () => {
    const app = createApp();
    const id = await addNote(app, 'Original', { body: 'old text' });
    await renderWithApp(<NoteEditorScreen noteId={id} defaults={NEW} />, app);
    const title = await screen.findByDisplayValue('Original');
    expect(screen.getByDisplayValue('old text')).toBeTruthy();
    await fireEvent.changeText(title, 'Renamed');
    await fireEvent.press(screen.getByLabelText('Save changes'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await app.notes.notes.get(id))?.title).toBe('Renamed');
  });

  it('says when the note no longer exists', async () => {
    await renderWithApp(<NoteEditorScreen noteId="ghost" defaults={NEW} />);
    expect(await screen.findByText('Note not found')).toBeTruthy();
  });

  it('archives and trashes from the editor', async () => {
    const app = createApp();
    const a = await addNote(app, 'To archive');
    const b = await addNote(app, 'To trash');
    await renderWithApp(<NoteEditorScreen noteId={a} defaults={NEW} />, app);
    await fireEvent.press(await screen.findByLabelText('Archive'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await app.notes.notes.get(a))?.archivedAt).not.toBeNull();

    jest.clearAllMocks();
    confirmAlerts();
    await renderWithApp(<NoteEditorScreen noteId={b} defaults={NEW} />, app);
    await fireEvent.press(await screen.findByLabelText('Move to trash'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await app.notes.notes.get(b))?.deletedAt).not.toBeNull();
  });

  it('offers to restore a note from the trash or the archive', async () => {
    const app = createApp();
    const trashed = await addNote(app, 'Trashed');
    const archived = await addNote(app, 'Archived');
    await app.notes.notes.trash([trashed]);
    await app.notes.notes.archive([archived]);

    await renderWithApp(<NoteEditorScreen noteId={trashed} defaults={NEW} />, app);
    expect(await screen.findByText('This note is in the trash.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Restore'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await app.notes.notes.get(trashed))?.deletedAt).toBeNull();

    jest.clearAllMocks();
    await renderWithApp(<NoteEditorScreen noteId={archived} defaults={NEW} />, app);
    expect(await screen.findByText('This note is archived.')).toBeTruthy();
    await fireEvent.press(screen.getAllByLabelText('Restore')[0]!);
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await app.notes.notes.get(archived))?.archivedAt).toBeNull();
  });
});

describe('NoteEditorScreen: locked notes', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('asks for the PIN before showing a locked note', async () => {
    const app = createApp();
    const id = await addNote(app, 'Diary', { body: 'dear diary', locked: true });
    await app.notes.lock.usePin('2468');
    app.notes.lock.lockNow();
    await renderWithApp(<NoteEditorScreen noteId={id} defaults={NEW} />, app);

    expect(await screen.findByText('This note is locked')).toBeTruthy();
    expect(screen.queryByDisplayValue('dear diary')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('PIN'), '0000');
    await fireEvent.press(screen.getByLabelText('Unlock'));
    expect(await screen.findByText('Wrong PIN. 4 tries left.')).toBeTruthy();
    expect(screen.queryByDisplayValue('dear diary')).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('PIN'), '2468');
    await fireEvent.press(screen.getByLabelText('Unlock'));
    expect(await screen.findByDisplayValue('dear diary')).toBeTruthy();
  });

  it('uses the phone’s own lock when that is how notes are protected', async () => {
    const app = createApp();
    const id = await addNote(app, 'Diary', { body: 'dear diary', locked: true });
    await app.notes.lock.useDeviceAuth();
    app.notes.lock.lockNow();
    await renderWithApp(<NoteEditorScreen noteId={id} defaults={NEW} />, app);

    app.noteFakes.authenticator.accepts = false;
    await fireEvent.press(await screen.findByLabelText('Unlock'));
    expect(await screen.findByText('Authentication was cancelled.')).toBeTruthy();
    app.noteFakes.authenticator.accepts = true;
    await fireEvent.press(screen.getByLabelText('Unlock'));
    expect(await screen.findByDisplayValue('dear diary')).toBeTruthy();
  });

  it('opens locked notes freely when no lock is set', async () => {
    const app = createApp();
    const id = await addNote(app, 'Diary', { body: 'dear diary', locked: true });
    await renderWithApp(<NoteEditorScreen noteId={id} defaults={NEW} />, app);
    expect(await screen.findByDisplayValue('dear diary')).toBeTruthy();
  });
});

describe('NoteEditorScreen: attachments', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    audio.__state.permission = true;
    audio.__state.uri = 'file:///cache/recording.m4a';
  });

  it('attaches an image, saving a new note first, and shows it in a viewer', async () => {
    const app = createApp();
    app.noteFakes.files.sources.set('content://photos/1', 'jpeg');
    app.noteFakes.picker.next = {
      uri: 'content://photos/1',
      name: 'cat.jpg',
      mime: 'image/jpeg',
      sizeBytes: 4,
    };
    await openNew(app);
    await fireEvent.press(screen.getByLabelText('Add image'));

    const item = await screen.findByLabelText(/^Image: cat\.jpg, 4 B/);
    expect((await all(app))[0]).toMatchObject({ title: 'Untitled', attachmentCount: 1 });
    expect(screen.getByDisplayValue('Untitled')).toBeTruthy();

    await fireEvent.press(item);
    expect(await screen.findByLabelText('Close image')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Close image'));
    await waitFor(() => expect(screen.queryByLabelText('Close image')).toBeNull());

    // Saving again updates the same note instead of creating a second one.
    await fireEvent.press(screen.getByLabelText('Save changes'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await all(app)).toHaveLength(1);
  });

  it('attaches a PDF and opens it with another app', async () => {
    const app = createApp();
    app.noteFakes.files.sources.set('content://docs/1', 'x'.repeat(2048));
    app.noteFakes.picker.next = {
      uri: 'content://docs/1',
      name: 'plan.pdf',
      mime: 'application/pdf',
      sizeBytes: 2048,
    };
    await openNew(app);
    await fireEvent.changeText(screen.getByLabelText('Title'), 'With PDF');
    await fireEvent.press(screen.getByLabelText('Add pdf'));
    await fireEvent.press(await screen.findByLabelText(/^PDF: plan\.pdf, 2 KB/));
    await waitFor(() =>
      expect(sharing.shareAsync).toHaveBeenCalledWith(
        expect.stringMatching(/\.pdf$/),
        expect.objectContaining({ mimeType: 'application/pdf' }),
      ),
    );
  });

  it('shows a clear message when a file cannot be attached', async () => {
    const app = createApp();
    app.noteFakes.picker.next = {
      uri: 'content://x',
      name: 'notes.txt',
      mime: 'text/plain',
      sizeBytes: 3,
    };
    await openNew(app);
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Bad file');
    await fireEvent.press(screen.getByLabelText('Add pdf'));
    expect(await screen.findByText('Choose a PDF file.')).toBeTruthy();
  });

  it('does nothing when the file chooser is cancelled', async () => {
    const app = createApp();
    app.noteFakes.picker.next = null;
    await openNew(app);
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Nothing');
    await fireEvent.press(screen.getByLabelText('Add image'));
    await waitFor(() => expect(screen.queryByLabelText('Adding attachment')).toBeNull());
    expect(screen.queryByLabelText(/^Image:/)).toBeNull();
  });

  it('records a voice note', async () => {
    const app = createApp();
    app.noteFakes.files.sources.set('file:///cache/recording.m4a', 'audio');
    await openNew(app);
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Voice');
    await fireEvent.press(screen.getByLabelText('Add voice recording'));
    await fireEvent.press(await screen.findByLabelText('Record'));
    expect(audio.__recorder.record).toHaveBeenCalled();
    await fireEvent.press(await screen.findByLabelText('Stop and save'));

    expect(await screen.findByLabelText(/^Voice recording: Voice note .*, 0:04/)).toBeTruthy();
    expect(audio.__recorder.stop).toHaveBeenCalled();
    expect((await all(app))[0]?.attachmentCount).toBe(1);
    expect(screen.getByLabelText('Play')).toBeTruthy();
  });

  it('explains when the microphone is not allowed', async () => {
    audio.__state.permission = false;
    await openNew();
    await fireEvent.press(screen.getByLabelText('Add voice recording'));
    await fireEvent.press(await screen.findByLabelText('Record'));
    expect(
      await screen.findByText('Allow microphone access in your phone settings to record.'),
    ).toBeTruthy();
    expect(audio.__recorder.record).not.toHaveBeenCalled();
  });

  it('draws, saves, and edits a drawing in place', async () => {
    const app = createApp();
    await openNew(app);
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Sketch');
    await fireEvent.press(screen.getByLabelText('Add drawing'));
    expect(await screen.findByLabelText('Drawing canvas, 0 strokes')).toBeTruthy();
    expect(screen.getByLabelText('Save drawing').props.accessibilityState.disabled).toBe(true);

    const stroke = (points: [number, number][]) =>
      fireGestureHandler(getByGestureTestId('drawing-canvas'), [
        { state: State.BEGAN, x: points[0]![0], y: points[0]![1] },
        { state: State.ACTIVE, x: points[0]![0], y: points[0]![1] },
        ...points.slice(1).map(([x, y]) => ({ x, y })),
        { state: State.END, x: points.at(-1)![0], y: points.at(-1)![1] },
      ]);
    stroke([
      [10, 10],
      [60, 80],
      [120, 90],
    ]);
    expect(await screen.findByLabelText('Drawing canvas, 1 stroke')).toBeTruthy();
    stroke([
      [5, 5],
      [50, 5],
    ]);
    expect(await screen.findByLabelText('Drawing canvas, 2 strokes')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Undo last stroke'));
    expect(await screen.findByLabelText('Drawing canvas, 1 stroke')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save drawing'));

    const saved = await screen.findByLabelText(/^Drawing: Drawing,/);
    const [note] = await all(app);
    const before = (await app.notes.notes.get(note!.id))!.attachments[0]!;
    expect((await app.notes.attachments.readDrawing(before))?.strokes).toHaveLength(1);

    await fireEvent.press(saved);
    expect(await screen.findByLabelText('Drawing canvas, 1 stroke')).toBeTruthy();
    stroke([
      [200, 200],
      [300, 300],
    ]);
    await fireEvent.press(await screen.findByLabelText('Save drawing'));
    await waitFor(async () => {
      const after = (await app.notes.notes.get(note!.id))!.attachments;
      expect(after).toHaveLength(1);
      expect(after[0]?.id).toBe(before.id);
      expect((await app.notes.attachments.readDrawing(after[0]!))?.strokes).toHaveLength(2);
    });
  });

  it('chooses pen colors and cancels a drawing without saving', async () => {
    const app = createApp();
    await openNew(app);
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Sketch');
    await fireEvent.press(screen.getByLabelText('Add drawing'));
    await fireEvent.press(await screen.findByLabelText('Pen color 2 of 8'));
    expect(screen.getByLabelText('Pen color 2 of 8').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByLabelText('Thick pen'));
    await fireEvent.press(screen.getByLabelText('Cancel'));
    await waitFor(() => expect(screen.queryByLabelText('Save drawing')).toBeNull());
    expect(screen.queryByLabelText(/^Drawing:/)).toBeNull();
  });

  it('removes an attachment after confirming', async () => {
    const app = createApp();
    app.noteFakes.files.sources.set('content://photos/1', 'jpeg');
    app.noteFakes.picker.next = {
      uri: 'content://photos/1',
      name: 'cat.jpg',
      mime: 'image/jpeg',
      sizeBytes: 4,
    };
    await openNew(app);
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Pics');
    await fireEvent.press(screen.getByLabelText('Add image'));
    await screen.findByLabelText(/^Image: cat\.jpg/);

    const alert = confirmAlerts();
    await fireEvent.press(screen.getByLabelText('Remove cat.jpg'));
    await waitFor(() => expect(screen.queryByLabelText(/^Image: cat\.jpg/)).toBeNull());
    expect(alert).toHaveBeenCalledWith('Remove cat.jpg?', expect.any(String), expect.any(Array));
    expect(app.noteFakes.files.files.size).toBe(0);
  });
});
