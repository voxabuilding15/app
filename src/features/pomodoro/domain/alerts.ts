import type { AlertPlan } from './ports';
import type { PomodoroSettings } from './settings';
import { nextPhase, startPhase, wantsAutoStart, type TimerKind, type TimerState } from './timer';

const PHASE_LABEL: Record<TimerKind, string> = {
  focus: 'Focus',
  short_break: 'Short break',
  long_break: 'Long break',
};

/** How many phase ends are scheduled ahead when auto-start chains phases together. */
const MAX_BOUNDARIES = 4;

function formatClock(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "24:05" for 1445 seconds. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * What the notification shade should show for the timer: the ongoing notification with its
 * controls, and an alert for each upcoming phase end. With auto-start on, the following phases
 * start by themselves even when the app is closed, so their ends are scheduled too.
 */
export function buildAlertPlan(state: TimerState, settings: PomodoroSettings): AlertPlan | null {
  if (state.status === 'idle') {
    return null;
  }

  const live =
    state.status === 'running'
      ? {
          title: `${PHASE_LABEL[state.kind]} in progress`,
          body: `Ends at ${formatClock(state.endsAt)}`,
          paused: false,
        }
      : {
          title: `${PHASE_LABEL[state.kind]} paused`,
          body: `${formatCountdown(state.remainingMs)} left`,
          paused: true,
        };

  const boundaries: AlertPlan['boundaries'] = [];
  if (state.status === 'running') {
    let current: TimerState = state;
    for (let step = 0; step < MAX_BOUNDARIES && current.status === 'running'; step += 1) {
      const finished = current.kind;
      const next = nextPhase(finished, current.cycle, 'completed', settings);
      const auto = wantsAutoStart(finished, settings);
      boundaries.push({
        at: current.endsAt,
        title: `${PHASE_LABEL[finished]} finished`,
        body: auto
          ? `${PHASE_LABEL[next.kind]} has started`
          : next.kind === 'focus'
            ? 'Ready for the next focus session?'
            : `Time for a ${PHASE_LABEL[next.kind].toLowerCase()}`,
      });
      current = auto
        ? startPhase(
            { ...current, status: 'idle', kind: next.kind, cycle: next.cycle },
            next.kind,
            current.endsAt,
            settings,
          )
        : { ...current, status: 'idle', kind: next.kind, cycle: next.cycle };
    }
  }
  return { boundaries, live, exact: settings.exactAlarm };
}
