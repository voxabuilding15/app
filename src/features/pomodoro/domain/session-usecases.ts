import type { HistoryQuery, LinkTarget, Session, SessionRecord } from './entities';
import type { LinkTargets, SessionRepository } from './ports';

/** How many history entries the list loads. */
const HISTORY_LIMIT = 200;
export const NOTE_MAX_LENGTH = 2_000;
export const MAX_TAGS_PER_SESSION = 10;

export type SessionDetails = Pick<SessionRecord, 'note' | 'taskId' | 'habitId' | 'tagIds'>;

interface SessionUseCaseDeps {
  sessions: SessionRepository;
  targets: LinkTargets;
}

export function createSessionUseCases({ sessions, targets }: SessionUseCaseDeps) {
  return {
    list(query: HistoryQuery): Promise<Session[]> {
      return sessions.list({ ...query, search: query.search.trim() }, HISTORY_LIMIT);
    },

    get(id: string): Promise<SessionRecord | null> {
      return sessions.get(id);
    },

    /** Edits what a saved focus session was about. */
    async updateDetails(id: string, details: SessionDetails): Promise<boolean> {
      const existing = await sessions.get(id);
      if (existing === null || existing.kind !== 'focus') {
        return false;
      }
      await sessions.updateDetails(id, {
        note: details.note.trim().slice(0, NOTE_MAX_LENGTH),
        taskId: details.taskId,
        habitId: details.habitId,
        tagIds: [...new Set(details.tagIds)].slice(0, MAX_TAGS_PER_SESSION),
      });
      return true;
    },

    /** Deletes an entry and hands it back so the caller can offer to undo. */
    async remove(id: string): Promise<SessionRecord | null> {
      const existing = await sessions.get(id);
      if (existing !== null) {
        await sessions.delete(id);
      }
      return existing;
    },

    async restore(record: SessionRecord): Promise<void> {
      await sessions.insert(record);
    },

    async linkTargets(): Promise<{ tasks: LinkTarget[]; habits: LinkTarget[] }> {
      const [tasks, habits] = await Promise.all([targets.tasks(), targets.habits()]);
      return { tasks, habits };
    },
  };
}

export type SessionUseCases = ReturnType<typeof createSessionUseCases>;
