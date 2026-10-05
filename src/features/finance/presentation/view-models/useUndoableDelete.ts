import { useCallback, useState } from 'react';

export interface Notice {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** One snackbar message at a time, for the lists that confirm what they just did. */
export function useNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const dismiss = useCallback(() => setNotice(null), []);
  return { notice, show: setNotice, dismiss };
}

interface UndoableDeleteOptions<T> {
  /** What was deleted, e.g. "Transaction": the message reads "Transaction deleted". */
  noun: string;
  /** Deletes the item and returns it, so it can be put back. */
  remove: (id: string) => Promise<T>;
  restore: (item: T) => Promise<void>;
  /** Refreshes the lists after every change. */
  onChanged: () => Promise<void>;
  show: (notice: Notice | null) => void;
  /** Turns a failure into a specific message; null falls back to the generic one. */
  explain?: (error: unknown) => string | null;
}

/**
 * Deletes an item at once and offers Undo in a snackbar. The record is kept in memory, so undoing
 * puts back exactly what was removed.
 */
export function useUndoableDelete<T>({
  noun,
  remove,
  restore,
  onChanged,
  show,
  explain,
}: UndoableDeleteOptions<T>): (id: string) => Promise<void> {
  return useCallback(
    async (id: string) => {
      try {
        const removed = await remove(id);
        show({
          message: `${noun} deleted`,
          actionLabel: 'Undo',
          onAction: () => {
            show(null);
            restore(removed)
              .catch(() => show({ message: `Couldn't restore the ${noun.toLowerCase()}` }))
              .finally(() => void onChanged());
          },
        });
      } catch (error) {
        show({ message: explain?.(error) ?? `Couldn't delete the ${noun.toLowerCase()}` });
      }
      await onChanged();
    },
    [noun, remove, restore, onChanged, show, explain],
  );
}
