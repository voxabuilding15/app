import { act } from '@testing-library/react-native';

import { emptyNoteDraft, type NoteDraft } from '@/features/notes/domain/validation';

import type { TestApp } from './harness';

async function must<T extends { ok: boolean }>(
  result: Promise<T>,
): Promise<Extract<T, { ok: true }>> {
  const saved = await result;
  if (!saved.ok) {
    throw new Error(`seed failed: ${JSON.stringify(saved)}`);
  }
  return saved as Extract<T, { ok: true }>;
}

/** Refreshes every mounted Notes query after seeding behind the screen's back. */
export const refresh = (app: TestApp) =>
  act(async () => {
    await app.client.invalidateQueries({ queryKey: ['notes'] });
  });

export async function addNote(
  app: TestApp,
  title: string,
  overrides: Partial<NoteDraft> = {},
): Promise<string> {
  const saved = await must(
    app.notes.notes.save({ ...emptyNoteDraft(), title, body: `${title} text`, ...overrides }, null),
  );
  return saved.id;
}

export async function addFolder(
  app: TestApp,
  name: string,
  parentId: string | null = null,
): Promise<string> {
  return (await must(app.notes.folders.save({ name, parentId }, null))).id;
}

export async function addTag(app: TestApp, name: string, color = '#16A34A'): Promise<string> {
  return (await must(app.notes.tags.save({ id: null, name, color }))).id;
}
