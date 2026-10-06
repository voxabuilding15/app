import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { NotesScreen } from '@/features/notes/presentation/screens/NotesScreen';

import { createApp, renderWithApp, router } from './harness';
import { addFolder, addNote, addTag, refresh } from './notes-seed';

const card = (title: string) => screen.getByLabelText(new RegExp(`^${title}(,|$)`));
const gone = (title: string) =>
  waitFor(() => expect(screen.queryByLabelText(new RegExp(`^${title}(,|$)`))).toBeNull());

describe('NotesScreen', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('shows an empty state with a working add action', async () => {
    await renderWithApp(<NotesScreen />);
    expect(await screen.findByText('No notes yet')).toBeTruthy();
    await fireEvent.press(screen.getAllByLabelText('Add note')[0]!);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/notes/new', params: {} });
  });

  it('lists notes with a plain-text preview, tags, folder and checklist progress', async () => {
    const app = createApp();
    const folder = await addFolder(app, 'Work');
    const tag = await addTag(app, 'Ideas');
    await addNote(app, 'Plan', {
      body: '# Goals\nShip **notes**\n- [x] design\n- [ ] build',
      folderId: folder,
      tagIds: [tag],
    });
    await renderWithApp(<NotesScreen />, app);

    const plan = await screen.findByLabelText(/^Plan, /);
    expect(plan.props.accessibilityLabel).toBe(
      'Plan, Goals · Ship notes · ☑ design · ☐ build, in Work, tags Ideas, 1 of 2 tasks done',
    );
    expect(screen.getByText('1/2')).toBeTruthy();
    expect(screen.getByText('Work')).toBeTruthy();
    expect(screen.getByText('Ideas')).toBeTruthy();
  });

  it('opens a note when pressed', async () => {
    const app = createApp();
    const id = await addNote(app, 'Open me');
    await renderWithApp(<NotesScreen />, app);
    await fireEvent.press(await screen.findByLabelText(/^Open me/));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/notes/[id]', params: { id } });
  });

  it('hides the text of locked notes', async () => {
    const app = createApp();
    await addNote(app, 'Diary', { body: 'very private', locked: true });
    await renderWithApp(<NotesScreen />, app);
    const diary = await screen.findByLabelText(/^Diary/);
    expect(diary.props.accessibilityLabel).toBe('Diary, locked');
    expect(screen.queryByText(/very private/)).toBeNull();
    expect(screen.getByText('Locked note')).toBeTruthy();
  });

  it('pins and favorites by swipe, moving pinned notes to the top', async () => {
    const app = createApp();
    await addNote(app, 'First');
    await addNote(app, 'Second');
    await renderWithApp(<NotesScreen />, app);
    await screen.findByLabelText(/^First/);

    const titles = () =>
      screen
        .getAllByLabelText(/^(First|Second)/)
        .map((node) => String(node.props.accessibilityLabel).split(',')[0]);
    const before = titles();
    await fireEvent.press(screen.getAllByLabelText('Pin')[before.indexOf('First')]!);
    await waitFor(() => expect(titles()[0]).toBe('First'));
    expect(card('First').props.accessibilityLabel).toContain('pinned');

    await fireEvent.press(screen.getAllByLabelText('Favorite')[0]!);
    await waitFor(() => expect(card('First').props.accessibilityLabel).toContain('favorite'));
    await fireEvent.press(screen.getByLabelText('Favorites'));
    expect(await screen.findByLabelText(/^First/)).toBeTruthy();
    await gone('Second');
  });

  it('archives with Undo, then finds the note in the archive and unarchives it', async () => {
    const app = createApp();
    await addNote(app, 'Shelve');
    await renderWithApp(<NotesScreen />, app);
    await screen.findByLabelText(/^Shelve/);

    // The first "Archive" is the scope tab, the second the swipe action.
    await fireEvent.press(screen.getAllByLabelText('Archive')[1]!);
    expect(await screen.findByText('Note archived')).toBeTruthy();
    await gone('Shelve');
    await fireEvent.press(screen.getByLabelText('Undo'));
    expect(await screen.findByLabelText(/^Shelve/)).toBeTruthy();

    await fireEvent.press(screen.getAllByLabelText('Archive')[1]!);
    await gone('Shelve');
    await fireEvent.press(screen.getAllByLabelText('Archive')[0]!); // the scope tab
    expect(await screen.findByLabelText(/^Shelve/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Unarchive'));
    expect(await screen.findByText('Note restored to your notes')).toBeTruthy();
    await gone('Shelve');
    await fireEvent.press(screen.getByLabelText('Notes'));
    expect(await screen.findByLabelText(/^Shelve/)).toBeTruthy();
  });

  it('moves a note to the trash with Undo, restores it, and deletes forever after confirming', async () => {
    const app = createApp();
    await addNote(app, 'Doomed');
    await renderWithApp(<NotesScreen />, app);
    await screen.findByLabelText(/^Doomed/);

    await fireEvent.press(screen.getByLabelText('Delete'));
    expect(await screen.findByText('Note moved to the trash')).toBeTruthy();
    await gone('Doomed');
    await fireEvent.press(screen.getByLabelText('Undo'));
    expect(await screen.findByLabelText(/^Doomed/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Delete'));
    await gone('Doomed');
    await fireEvent.press(screen.getByLabelText('Trash'));
    expect(await screen.findByLabelText(/^Doomed/)).toBeTruthy();
    expect(screen.getByText('Notes in the trash are deleted for good after 30 days.')).toBeTruthy();
    expect(screen.queryByLabelText('Add note')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Restore'));
    expect(await screen.findByText('Note restored')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Notes'));
    expect(await screen.findByLabelText(/^Doomed/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Delete'));
    await fireEvent.press(screen.getByLabelText('Trash'));
    await screen.findByLabelText(/^Doomed/);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    await fireEvent.press(screen.getByLabelText('Delete forever'));
    await gone('Doomed');
    expect(alert).toHaveBeenCalledWith('Delete forever?', expect.any(String), expect.any(Array));
    expect(
      await app.notes.notes.get(
        (
          await app.notes.notes.list(
            {
              scope: 'trash',
              search: '',
              folderId: null,
              tagIds: [],
              color: null,
              withAttachments: false,
              withReminder: false,
            },
            { field: 'updated', direction: 'desc' },
            5,
          )
        )[0]?.id ?? 'x',
      ),
    ).toBeNull();
  });

  it('empties the trash after confirming', async () => {
    const app = createApp();
    const a = await addNote(app, 'A');
    const b = await addNote(app, 'B');
    await app.notes.notes.trash([a, b]);
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    await renderWithApp(<NotesScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Trash'));
    await fireEvent.press(await screen.findByLabelText('Empty trash'));
    expect(await screen.findByText('2 notes deleted')).toBeTruthy();
    expect(await screen.findByText('The trash is empty')).toBeTruthy();
  });

  it('searches titles, text and tags, and explains when nothing matches', async () => {
    const app = createApp();
    const tag = await addTag(app, 'Recipes');
    await addNote(app, 'Pasta', { body: 'boil water' });
    await addNote(app, 'Soup', { body: 'x', tagIds: [tag] });
    await addNote(app, 'Taxes', { body: 'file forms' });
    await renderWithApp(<NotesScreen />, app);
    await screen.findByLabelText(/^Pasta/);

    await fireEvent.press(screen.getByLabelText('Search'));
    await fireEvent.changeText(screen.getByLabelText('Search notes'), 'recip');
    expect(await screen.findByLabelText(/^Soup/)).toBeTruthy();
    await gone('Pasta');
    await fireEvent.changeText(screen.getByLabelText('Search notes'), 'water');
    expect(await screen.findByLabelText(/^Pasta/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search notes'), 'zzz');
    expect(await screen.findByText('No matching notes')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Clear search and filters'));
    expect(await screen.findByLabelText(/^Taxes/)).toBeTruthy();
  });

  it('filters by folder, tag, color, attachments and reminders', async () => {
    const app = createApp();
    const work = await addFolder(app, 'Work');
    const nested = await addFolder(app, 'Plans', work);
    const tag = await addTag(app, 'Urgent');
    await addNote(app, 'Top', { folderId: work });
    await addNote(app, 'Deep', { folderId: nested, tagIds: [tag], color: '#7B2FF7' });
    await addNote(app, 'Loose', { reminderAt: Date.now() + 86_400_000 });
    await renderWithApp(<NotesScreen />, app);
    await screen.findByLabelText(/^Top/);

    await fireEvent.press(screen.getByLabelText('Filter'));
    await fireEvent.press(await screen.findByLabelText('Work'));
    await waitFor(() => expect(screen.queryByLabelText(/^Loose/)).toBeNull());
    expect(screen.getByLabelText(/^Deep/)).toBeTruthy(); // subfolders are included
    expect(screen.getByLabelText(/^Top/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Work / Plans'));
    await waitFor(() => expect(screen.queryByLabelText(/^Top/)).toBeNull());
    await fireEvent.press(screen.getByLabelText('Reset'));
    await fireEvent.press(screen.getByLabelText('Urgent'));
    await waitFor(() => expect(screen.queryByLabelText(/^Top/)).toBeNull());
    expect(screen.getByLabelText(/^Deep/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Reset'));
    await fireEvent.press(screen.getByLabelText('Color 1'));
    await waitFor(() => expect(screen.queryByLabelText(/^Loose/)).toBeNull());
    await fireEvent.press(screen.getByLabelText('Reset'));
    await fireEvent.press(screen.getByLabelText('Reminder'));
    await waitFor(() => expect(screen.queryByLabelText(/^Top/)).toBeNull());
    expect(screen.getByLabelText(/^Loose/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('No folder'));
    expect(await screen.findByLabelText(/^Loose/)).toBeTruthy();
  });

  it('sorts by title', async () => {
    const app = createApp();
    await addNote(app, 'banana');
    await addNote(app, 'Apple');
    await renderWithApp(<NotesScreen />, app);
    await screen.findByLabelText(/^banana/);
    const order = () =>
      screen
        .getAllByLabelText(/^(banana|Apple)/)
        .map((n) => String(n.props.accessibilityLabel).split(',')[0]);

    await fireEvent.press(screen.getByLabelText(/^Sort by Last edited/));
    await fireEvent.press(await screen.findByLabelText('Title'));
    await fireEvent.press(screen.getByLabelText('Ascending'));
    await waitFor(() => expect(order()).toEqual(['Apple', 'banana']));
    await fireEvent.press(screen.getByLabelText('Descending'));
    await waitFor(() => expect(order()).toEqual(['banana', 'Apple']));
  });

  it('refreshes when notes change elsewhere', async () => {
    const app = createApp();
    await renderWithApp(<NotesScreen />, app);
    await screen.findByText('No notes yet');
    await addNote(app, 'Late arrival');
    await refresh(app);
    expect(await screen.findByLabelText(/^Late arrival/)).toBeTruthy();
  });

  it('opens folders, tags and lock settings', async () => {
    await renderWithApp(<NotesScreen />);
    await fireEvent.press(await screen.findByLabelText('Manage folders'));
    await fireEvent.press(screen.getByLabelText('Manage tags'));
    await fireEvent.press(screen.getByLabelText('Lock settings'));
    expect(router.push.mock.calls.map((call) => call[0])).toEqual([
      '/notes/folders',
      '/notes/tags',
      '/notes/lock',
    ]);
  });
});
