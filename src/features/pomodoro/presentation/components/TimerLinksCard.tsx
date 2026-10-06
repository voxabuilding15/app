import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { TimerViewModel } from '../view-models/useTimerViewModel';

import { SessionDetailsFields } from './SessionDetailsFields';

const NOTE_SAVE_DELAY_MS = 600;

/** Chooses what the current or next focus session is about; changes are kept as you make them. */
export function TimerLinksCard({ vm }: { vm: TimerViewModel }) {
  const router = useRouter();
  const { setLinks } = vm;
  // While typing, the text on screen is the draft; once saved, the timer's own note shows again.
  const [draft, setDraft] = useState<string | null>(null);
  const typed = useRef('');
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timeout.current !== null) {
      clearTimeout(timeout.current);
      timeout.current = null;
    }
    const text = typed.current;
    await setLinks({ note: text });
    setDraft((current) => (current === text ? null : current));
  }, [setLinks]);

  const flushOnUnmount = useRef(flush);
  useEffect(() => {
    flushOnUnmount.current = flush;
  });
  useEffect(
    () => () => {
      if (timeout.current !== null) {
        void flushOnUnmount.current();
      }
    },
    [],
  );

  const changeNote = (text: string) => {
    typed.current = text;
    setDraft(text);
    if (timeout.current !== null) {
      clearTimeout(timeout.current);
    }
    timeout.current = setTimeout(() => void flush(), NOTE_SAVE_DELAY_MS);
  };

  return (
    <SessionDetailsFields
      title="This session"
      details={{ ...vm.links, note: draft ?? vm.links.note }}
      tasks={vm.tasks}
      habits={vm.habits}
      tags={vm.tags}
      onChange={(changes) => {
        const { note, ...links } = changes;
        if (note !== undefined) {
          changeNote(note);
        }
        if (Object.keys(links).length > 0) {
          void setLinks(links);
        }
      }}
      onNoteBlur={() => {
        if (timeout.current !== null) {
          void flush();
        }
      }}
      onManageTags={() => router.push('/pomodoro/tags')}
    />
  );
}
