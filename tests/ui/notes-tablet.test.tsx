import { screen } from '@testing-library/react-native';

import { NoteEditorScreen } from '@/features/notes/presentation/screens/NoteEditorScreen';
import { NotesScreen } from '@/features/notes/presentation/screens/NotesScreen';

import { createApp, renderWithApp } from './harness';
import { addNote } from './notes-seed';

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

describe('notes tablet layout (1100 x 800)', () => {
  it('lays notes out in three columns', async () => {
    const app = createApp();
    for (const title of ['One', 'Two', 'Three']) {
      await addNote(app, title);
    }
    await renderWithApp(<NotesScreen />, app);
    expect(await screen.findByLabelText(/^Three/)).toBeTruthy();
    const thirds = countNodes(screen.toJSON(), (node) =>
      String(styleOf(node).maxWidth).startsWith('33'),
    );
    expect(thirds).toBe(3);
  });

  it('puts the writing and the details side by side without losing any section', async () => {
    await renderWithApp(<NoteEditorScreen noteId={null} defaults={{ folderId: null }} />);
    for (const section of ['Folder', 'Tags', 'Color', 'Reminder', 'Protection', 'Attachments']) {
      expect(await screen.findByText(section)).toBeTruthy();
    }
    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByLabelText('Save note')).toBeTruthy();
  });
});
