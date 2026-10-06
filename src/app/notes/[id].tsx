import { useLocalSearchParams } from 'expo-router';

import { NoteEditorScreen } from '@/features/notes';

export default function EditNoteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <NoteEditorScreen key={id} noteId={id} defaults={{ folderId: null }} />;
}
