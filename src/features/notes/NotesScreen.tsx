import { EmptyState, Screen } from '@/components';

export function NotesScreen() {
  return (
    <Screen>
      <EmptyState
        icon="sticky-note-2"
        title="No notes yet"
        message="Notes, checklists and folders will be kept here, offline on your device."
      />
    </Screen>
  );
}
