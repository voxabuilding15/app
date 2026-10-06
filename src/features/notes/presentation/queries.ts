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

import { useNotesModule } from './module';

const ROOT = ['notes'] as const;

/** The query key behind the lock state, shared with the lock controls. */
export const NOTES_LOCK_KEY = [...ROOT, 'lock'] as const;

const keys = {
  list: (filter: NoteFilter, sort: NoteSort, limit: number) =>
    [...ROOT, 'list', filter, sort, limit] as const,
  detail: (id: string) => [...ROOT, 'detail', id] as const,
  attachments: (id: string) => [...ROOT, 'attachments', id] as const,
  folders: [...ROOT, 'folders'] as const,
  tags: [...ROOT, 'tags'] as const,
  lock: NOTES_LOCK_KEY,
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

/** Refreshes every Notes query after a write. */
export function useInvalidateNotes(): () => Promise<void> {
  const client = useQueryClient();
  return useCallback(() => client.invalidateQueries({ queryKey: ROOT }), [client]);
}
