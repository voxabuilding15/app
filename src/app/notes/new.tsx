import { useLocalSearchParams } from 'expo-router';

import { NoteEditorScreen } from '@/features/notes';

export default function NewNoteRoute() {
  const { folderId } = useLocalSearchParams<{ folderId?: string }>();
  return <NoteEditorScreen noteId={null} defaults={{ folderId: folderId ?? null }} />;
}
