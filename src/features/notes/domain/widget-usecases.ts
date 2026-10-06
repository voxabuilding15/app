import type { Clock } from '@/core';

import { DEFAULT_FILTER, DEFAULT_SORT } from './filters';
import type { NoteRepository, WidgetPublisher } from './ports';
import { WIDGET_NOTE_LIMIT, buildWidgetSnapshot, type WidgetSnapshot } from './widget';

interface WidgetUseCaseDeps {
  notes: NoteRepository;
  publisher: WidgetPublisher;
  clock: Clock;
}

export function createWidgetUseCases({ notes, publisher, clock }: WidgetUseCaseDeps) {
  async function snapshot(): Promise<WidgetSnapshot> {
    const active = await notes.list(
      { ...DEFAULT_FILTER, folderIds: null, withoutFolder: false },
      DEFAULT_SORT,
      WIDGET_NOTE_LIMIT,
    );
    return buildWidgetSnapshot(active, clock.now());
  }

  return {
    snapshot,
    /** Pinned notes first, then the most recently edited ones. */
    async publish(): Promise<void> {
      publisher.publish(await snapshot());
    },
  };
}

export type WidgetUseCases = ReturnType<typeof createWidgetUseCases>;
