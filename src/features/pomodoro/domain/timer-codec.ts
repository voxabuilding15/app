import { IDLE_STATE, NO_LINKS, type SessionLinks, type TimerKind, type TimerState } from './timer';

const KINDS: readonly TimerKind[] = ['focus', 'short_break', 'long_break'];

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw => typeof value === 'object' && value !== null;
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isTime = (value: unknown): value is number => typeof value === 'number' && value > 0;
const orNull = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

function readLinks(raw: unknown): SessionLinks {
  if (!isRecord(raw)) {
    return NO_LINKS;
  }
  return {
    taskId: orNull(raw.taskId),
    habitId: orNull(raw.habitId),
    tagIds: Array.isArray(raw.tagIds)
      ? raw.tagIds.filter((id): id is string => typeof id === 'string')
      : [],
    note: typeof raw.note === 'string' ? raw.note : '',
  };
}

/** Reads a stored timer, falling back to an idle one when it is missing or damaged. */
export function parseTimerState(json: string | undefined): TimerState {
  if (json === undefined) {
    return IDLE_STATE;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return IDLE_STATE;
  }
  if (!isRecord(raw) || !KINDS.includes(raw.kind as TimerKind) || !isCount(raw.cycle)) {
    return IDLE_STATE;
  }
  const kind = raw.kind as TimerKind;
  const links = readLinks(raw.links);

  if (raw.status === 'idle') {
    return { status: 'idle', kind, cycle: raw.cycle, links };
  }
  const common = {
    kind,
    cycle: raw.cycle,
    links,
    pauses: isCount(raw.pauses) ? raw.pauses : 0,
  };
  if (!isTime(raw.startedAt) || !isTime(raw.durationMs)) {
    return IDLE_STATE;
  }
  if (raw.status === 'running' && isTime(raw.endsAt)) {
    return {
      status: 'running',
      ...common,
      startedAt: raw.startedAt,
      endsAt: raw.endsAt,
      durationMs: raw.durationMs,
    };
  }
  if (raw.status === 'paused' && typeof raw.remainingMs === 'number' && raw.remainingMs >= 0) {
    return {
      status: 'paused',
      ...common,
      startedAt: raw.startedAt,
      remainingMs: raw.remainingMs,
      durationMs: raw.durationMs,
    };
  }
  return IDLE_STATE;
}
