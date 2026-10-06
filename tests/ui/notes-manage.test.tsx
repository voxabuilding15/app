import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, AppState } from 'react-native';

import { NotesBridge } from '@/features/notes/presentation/NotesBridge';
import { FoldersScreen } from '@/features/notes/presentation/screens/FoldersScreen';
import { LockSettingsScreen } from '@/features/notes/presentation/screens/LockSettingsScreen';
import { TagsScreen } from '@/features/notes/presentation/screens/TagsScreen';

import { createApp, renderWithApp, router } from './harness';
import { addFolder, addNote } from './notes-seed';

function confirmAlerts() {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((button) => button.style === 'destructive')?.onPress?.();
  });
}

describe('FoldersScreen', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('creates folders, nests them and shows note counts', async () => {
    const app = createApp();
    await renderWithApp(<FoldersScreen />, app);
    expect(await screen.findByText('No folders yet')).toBeTruthy();

    await fireEvent.press(screen.getAllByLabelText('Add folder')[0]!);
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Work');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByLabelText('Work, 0 notes')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('New folder inside Work'));
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Plans');
    expect(screen.getByLabelText('Inside Work. Change')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByLabelText('Plans, 0 notes')).toBeTruthy();

    const [work, plans] = await app.notes.folders
      .list()
      .then((all) => [all.find((f) => f.name === 'Work'), all.find((f) => f.name === 'Plans')]);
    expect(plans?.parentId).toBe(work?.id);
  });

  it('counts the notes in each folder', async () => {
    const app = createApp();
    const folder = await addFolder(app, 'Ideas');
    await addNote(app, 'One', { folderId: folder });
    await addNote(app, 'Two', { folderId: folder });
    await renderWithApp(<FoldersScreen />, app);
    expect(await screen.findByLabelText('Ideas, 2 notes')).toBeTruthy();
  });

  it('renames and moves a folder, and explains why some moves are refused', async () => {
    const app = createApp();
    const a = await addFolder(app, 'A');
    const b = await addFolder(app, 'B', a);
    await addFolder(app, 'C');
    await renderWithApp(<FoldersScreen />, app);
    await screen.findByLabelText('B, 0 notes');

    await fireEvent.press(screen.getByLabelText('Edit B'));
    await fireEvent.changeText(await screen.findByDisplayValue('B'), 'Bee');
    await fireEvent.press(screen.getByLabelText('Inside A. Change'));
    await fireEvent.press(await screen.findByLabelText('Top level'));
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByLabelText('Bee, 0 notes')).toBeTruthy();
    expect((await app.notes.folders.list()).find((f) => f.id === b)).toMatchObject({
      name: 'Bee',
      parentId: null,
    });

    // A folder cannot be moved inside itself: it is not offered, and a clash is explained.
    await fireEvent.press(screen.getByLabelText('Edit A'));
    await fireEvent.press(await screen.findByLabelText('Inside Top level. Change'));
    expect(screen.queryByLabelText('A')).toBeNull();
    await fireEvent.press(screen.getAllByLabelText('Cancel').at(-1)!);
    await fireEvent.changeText(screen.getByDisplayValue('A'), 'bee');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('A folder with this name already exists here')).toBeTruthy();
  });

  it('validates folder names', async () => {
    await renderWithApp(<FoldersScreen />);
    await fireEvent.press((await screen.findAllByLabelText('Add folder'))[0]!);
    await fireEvent.press(await screen.findByLabelText('Save'));
    expect(await screen.findByText('Enter a name')).toBeTruthy();
  });

  it('deletes a folder after confirming, moving its notes up a level', async () => {
    const app = createApp();
    const parent = await addFolder(app, 'Parent');
    const child = await addFolder(app, 'Child', parent);
    const note = await addNote(app, 'Inside', { folderId: child });
    const alert = confirmAlerts();
    await renderWithApp(<FoldersScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Delete Child'));

    expect(alert).toHaveBeenCalledWith('Delete "Child"?', expect.any(String), expect.any(Array));
    expect(await screen.findByText('"Child" deleted. Its notes moved up one level.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByLabelText(/^Child/)).toBeNull());
    expect((await app.notes.notes.get(note))?.folder?.name).toBe('Parent');
  });

  it('explains when a folder cannot be deleted because of a name clash', async () => {
    const app = createApp();
    const root = await addFolder(app, 'Root');
    const mid = await addFolder(app, 'Mid', root);
    await addFolder(app, 'Same', mid);
    await addFolder(app, 'Same', root);
    confirmAlerts();
    await renderWithApp(<FoldersScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Delete Mid'));
    expect(await screen.findByText(/A folder named "Same" already exists/)).toBeTruthy();
    expect(screen.getByLabelText(/^Mid/)).toBeTruthy();
  });
});

describe('TagsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('adds, renames and deletes tags, rejecting duplicates', async () => {
    const app = createApp();
    await renderWithApp(<TagsScreen />, app);
    expect(await screen.findByText('No tags yet')).toBeTruthy();

    await fireEvent.press(screen.getAllByLabelText('Add tag')[0]!);
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Ideas');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('Ideas')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Add tag'));
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'ideas');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('This name is already in use')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Cancel'));

    await fireEvent.press(screen.getByLabelText('Edit Ideas'));
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Plans');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('Plans')).toBeTruthy();

    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await fireEvent.press(screen.getByLabelText('Delete Plans'));
    alert.mock.calls[0]?.[2]?.find((button) => button.style === 'destructive')?.onPress?.();
    await waitFor(() => expect(screen.queryByText('Plans')).toBeNull());
    expect(await app.notes.tags.list()).toHaveLength(0);
  });
});

describe('LockSettingsScreen', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('turns on the phone’s own lock', async () => {
    const app = createApp();
    await renderWithApp(<LockSettingsScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Fingerprint, face or screen lock'));
    expect(await screen.findByText('Notes now use your phone’s lock')).toBeTruthy();
    expect(app.notes.lock.method()).toBe('device');
    expect(
      screen.getByLabelText('Fingerprint, face or screen lock').props.accessibilityState.selected,
    ).toBe(true);
  });

  it('explains when the phone has no lock set up', async () => {
    const app = createApp();
    app.noteFakes.authenticator.available = false;
    await renderWithApp(<LockSettingsScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Fingerprint, face or screen lock'));
    expect(await screen.findByText(/Set up a fingerprint, face or screen lock/)).toBeTruthy();
    expect(app.notes.lock.method()).toBe('none');
  });

  it('sets a PIN typed twice and rejects mismatches and weak PINs', async () => {
    const app = createApp();
    await renderWithApp(<LockSettingsScreen />, app);
    await fireEvent.press(await screen.findByLabelText('PIN'));

    await fireEvent.changeText(await screen.findByLabelText('New PIN'), '2468');
    await fireEvent.changeText(screen.getByLabelText('Repeat PIN'), '2469');
    await fireEvent.press(screen.getByLabelText('Save PIN'));
    expect(await screen.findByText('The two PINs do not match')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('New PIN'), '12');
    await fireEvent.changeText(screen.getByLabelText('Repeat PIN'), '12');
    await fireEvent.press(screen.getByLabelText('Save PIN'));
    expect(await screen.findByText('Use 4 to 8 digits')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('New PIN'), '2468');
    await fireEvent.changeText(screen.getByLabelText('Repeat PIN'), '2468');
    await fireEvent.press(screen.getByLabelText('Save PIN'));
    expect(await screen.findByText('Your PIN is set')).toBeTruthy();
    expect(app.notes.lock.method()).toBe('pin');
  });

  it('asks for the PIN before allowing changes, and can turn the lock off', async () => {
    const app = createApp();
    await app.notes.lock.usePin('2468');
    app.notes.lock.lockNow();
    await renderWithApp(<LockSettingsScreen />, app);

    expect(await screen.findByText('Your notes is locked')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('PIN'), '2468');
    await fireEvent.press(screen.getByLabelText('Unlock'));
    await fireEvent.press(await screen.findByLabelText('Off'));
    expect(await screen.findByText('Locking is off')).toBeTruthy();
    expect(app.notes.lock.method()).toBe('none');
  });

  it('locks again on demand', async () => {
    const app = createApp();
    await app.notes.lock.usePin('2468');
    await renderWithApp(<LockSettingsScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Lock now'));
    expect(app.notes.lock.isUnlocked()).toBe(false);
    expect(await screen.findByLabelText('PIN')).toBeTruthy();
  });
});

describe('NotesBridge', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens the note when its reminder is tapped, including from a cold start', async () => {
    const app = createApp();
    await renderWithApp(<NotesBridge />, app);
    await act(async () => app.container.notifications as never);
    (app.container.notifications as unknown as { emit: (r: object) => void }).emit({
      actionId: 'default',
      data: { noteId: 'n1' },
    });
    expect(router.push).toHaveBeenCalledWith({ pathname: '/notes/[id]', params: { id: 'n1' } });

    (app.container.notifications as unknown as { emit: (r: object) => void }).emit({
      actionId: 'default',
      data: { taskId: 't' },
    });
    (app.container.notifications as unknown as { emit: (r: object) => void }).emit({
      actionId: 'dismiss',
      data: { noteId: 'n2' },
    });
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('opens a note tapped from a cold start', async () => {
    const app = createApp();
    (app.container.notifications as unknown as { launchResponse: object }).launchResponse = {
      actionId: 'default',
      data: { noteId: 'cold' },
    };
    await renderWithApp(<NotesBridge />, app);
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({ pathname: '/notes/[id]', params: { id: 'cold' } }),
    );
  });

  it('clears old trash at start-up and refreshes the widget snapshot', async () => {
    const app = createApp();
    const purge = jest.spyOn(app.notes.notes, 'purgeExpired');
    const publish = jest.spyOn(app.notes.widgets, 'publish');
    await renderWithApp(<NotesBridge />, app);
    await waitFor(() => expect(publish).toHaveBeenCalled());
    expect(purge).toHaveBeenCalledTimes(1);
  });

  it('locks notes again when the app goes to the background', async () => {
    const app = createApp();
    await app.notes.lock.usePin('2468');
    let listener: (state: string) => void = () => undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      listener = handler as (state: string) => void;
      return { remove: jest.fn() } as never;
    });
    await renderWithApp(<NotesBridge />, app);
    expect(app.notes.lock.isUnlocked()).toBe(true);
    await act(async () => listener('background'));
    expect(app.notes.lock.isUnlocked()).toBe(false);
    await act(async () => listener('active'));
  });
});
