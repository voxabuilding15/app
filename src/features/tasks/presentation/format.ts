import { addDays, hasWeekday, startOfDay } from '@/core';
import type { DueDate, Priority, RepeatRule, Task } from '../domain/entities';
import { WEEKDAY_DISPLAY_ORDER, WEEKDAY_LABELS } from '@/components';

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDate(at: number, now: number, withYear = false): string {
  const today = startOfDay(now);
  const day = startOfDay(at);
  if (day === today) {
    return 'Today';
  }
  if (day === addDays(today, 1)) {
    return 'Tomorrow';
  }
  if (day === addDays(today, -1)) {
    return 'Yesterday';
  }
  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
  return new Date(at).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: sameYear && !withYear ? undefined : 'numeric',
  });
}

export function formatDue(due: DueDate, now: number): string {
  const date = formatDate(due.at, now);
  return due.hasTime ? `${date}, ${formatTime(due.at)}` : date;
}

export function isOverdue(task: Pick<Task, 'due' | 'completedAt'>, now: number): boolean {
  if (task.due === null || task.completedAt !== null) {
    return false;
  }
  return task.due.hasTime ? task.due.at < now : task.due.at < startOfDay(now);
}

export function describeRepeat(rule: RepeatRule): string {
  const { unit, interval, weekdays } = rule;
  if (unit === 'week' && weekdays !== 0) {
    const days = WEEKDAY_DISPLAY_ORDER.filter((day) => hasWeekday(weekdays, day))
      .map((day) => WEEKDAY_LABELS[day])
      .join(', ');
    return interval === 1 ? `Weekly on ${days}` : `Every ${interval} weeks on ${days}`;
  }
  if (interval === 1) {
    return unit === 'day' ? 'Daily' : unit === 'week' ? 'Weekly' : 'Monthly';
  }
  return `Every ${interval} ${unit}s`;
}

export function describeReminderOffset(offsetMinutes: number, hasTime: boolean): string {
  if (!hasTime) {
    if (offsetMinutes === 0) {
      return 'On the day, 9:00';
    }
    return offsetMinutes === 1440
      ? '1 day before, 9:00'
      : `${offsetMinutes / 1440} days before, 9:00`;
  }
  if (offsetMinutes === 0) {
    return 'At due time';
  }
  if (offsetMinutes === 1440) {
    return '1 day before';
  }
  return offsetMinutes >= 60 ? `${offsetMinutes / 60} hour before` : `${offsetMinutes} min before`;
}

/** Accessible one-sentence summary of a task for screen readers. */
export function describeTask(task: Task, now: number): string {
  const parts = [task.title];
  if (task.completedAt !== null) {
    parts.push('completed');
  }
  parts.push(`${PRIORITY_LABEL[task.priority]} priority`);
  if (task.due !== null) {
    parts.push(`${isOverdue(task, now) ? 'overdue, ' : ''}due ${formatDue(task.due, now)}`);
  }
  if (task.repeat !== null) {
    parts.push(describeRepeat(task.repeat).toLowerCase());
  }
  if (task.category !== null) {
    parts.push(`category ${task.category.name}`);
  }
  if (task.subtaskTotal > 0) {
    parts.push(`${task.subtaskDone} of ${task.subtaskTotal} subtasks done`);
  }
  return parts.join(', ');
}
