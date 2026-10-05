import { addDays, startOfDay } from '@/core';
import type { DueDate, Priority, Task } from '../domain/entities';
import { describeRecurrence } from '@/components';

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
    parts.push(describeRecurrence(task.repeat).toLowerCase());
  }
  if (task.category !== null) {
    parts.push(`category ${task.category.name}`);
  }
  if (task.subtaskTotal > 0) {
    parts.push(`${task.subtaskDone} of ${task.subtaskTotal} subtasks done`);
  }
  return parts.join(', ');
}
