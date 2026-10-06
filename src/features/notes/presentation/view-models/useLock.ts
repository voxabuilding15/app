import { useLockController } from '@/hooks';

import { useNotesModule } from '../module';
import { NOTES_LOCK_KEY } from '../queries';

/** Reads the notes lock state and exposes the actions that change it, keeping every screen in sync. */
export function useLock() {
  const { lock } = useNotesModule();
  return useLockController(lock, NOTES_LOCK_KEY);
}
