import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback } from 'react';

import type { Category } from '@/core';

import type {
  Attachment,
  FolderNode,
  FolderWithCount,
  NoteDetail,
  NoteSummary,
} from '../domain/entities';
import type { NoteFilter, NoteSort } from '../domain/filters';
import type { LockMethod } from '../domain/lock';

import { useNotesModule } from './module';

const ROOT = ['notes'] as const;

const keys = {
  list: (filter: NoteFilter, sort: NoteSort, limit: number) =>
    [...ROOT, 'list', filter, sort, limit] as const,
  detail: (id: string) => [...ROOT, 'detail', id] as const,
  attachments: (id: string) => [...ROOT, 'attachments', id] as const,
  folders: [...ROOT, 'folders'] as const,
  tags: [...ROOT, 'tags'] as const,
  lock: [...ROOT, 'lock'] as const,
};

export function useNotes(
  filter: NoteFilter,
  sort: NoteSort,
  limit: number,
): UseQueryResult<NoteSummary[]> {
  const { notes } = useNotesModule();
  return useQuery({
    queryKey: keys.list(filter, sort, limit),
    queryFn: () => notes.list(filter, sort, limit),
    placeholderData: keepPreviousData,
  });
}

export function useNote(id: string | null): UseQueryResult<NoteDetail | null> {
  const { notes } = useNotesModule();
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    queryFn: () => (id === null ? null : notes.get(id)),
    enabled: id !== null,
    // The editor owns its own copy of the text; never replace it while someone is typing.
    gcTime: 0,
  });
}

export function useAttachments(noteId: string | null): UseQueryResult<Attachment[]> {
  const { attachments } = useNotesModule();
  return useQuery({
    queryKey: keys.attachments(noteId ?? ''),
    queryFn: () => (noteId === null ? [] : attachments.list(noteId)),
    enabled: noteId !== null,
  });
}

export function useFolders(): UseQueryResult<FolderWithCount[]> {
  const { folders } = useNotesModule();
  return useQuery({ queryKey: keys.folders, queryFn: () => folders.list() });
}

export function useFolderTree(): UseQueryResult<FolderNode[]> {
  const { folders } = useNotesModule();
  return useQuery({ queryKey: [...keys.folders, 'tree'], queryFn: () => folders.tree() });
}

export function useTags(): UseQueryResult<Category[]> {
  const { tags } = useNotesModule();
  return useQuery({ queryKey: keys.tags, queryFn: () => tags.list() });
}

export interface LockStatus {
  method: LockMethod;
  unlocked: boolean;
}

/** How notes are locked and whether they are open right now. */
export function useLockStatus(): LockStatus {
  const { lock } = useNotesModule();
  const { data } = useQuery({
    queryKey: keys.lock,
    queryFn: (): LockStatus => ({ method: lock.method(), unlocked: lock.isUnlocked() }),
    initialData: () => ({ method: lock.method(), unlocked: lock.isUnlocked() }),
    staleTime: 0,
  });
  return data;
}

/** Refreshes every Notes query after a write. */
export function useInvalidateNotes(): () => Promise<void> {
  const client = useQueryClient();
  return useCallback(() => client.invalidateQueries({ queryKey: ROOT }), [client]);
}
