export type NoteScope = 'notes' | 'favorites' | 'archived' | 'trash';

/** Folder filter meaning "notes that are not in any folder". */
export const NO_FOLDER = '__none__';

export interface NoteFilter {
  scope: NoteScope;
  search: string;
  /** A folder id (including everything inside it), `NO_FOLDER`, or null for every folder. */
  folderId: string | null;
  /** Notes with any of these tags. */
  tagIds: readonly string[];
  color: string | null;
  withAttachments: boolean;
  withReminder: boolean;
}

export const DEFAULT_FILTER: NoteFilter = {
  scope: 'notes',
  search: '',
  folderId: null,
  tagIds: [],
  color: null,
  withAttachments: false,
  withReminder: false,
};

export type NoteSortField = 'updated' | 'created' | 'title';

export interface NoteSort {
  field: NoteSortField;
  direction: 'asc' | 'desc';
}

export const DEFAULT_SORT: NoteSort = { field: 'updated', direction: 'desc' };

/** What the repository filters on: the folder filter is resolved to concrete folder ids. */
export interface NoteQuery extends Omit<NoteFilter, 'folderId'> {
  /** Restrict to notes in these folders; null for no restriction. */
  folderIds: readonly string[] | null;
  /** Restrict to notes without a folder. */
  withoutFolder: boolean;
}

export function countActiveFilters(filter: NoteFilter): number {
  return (
    (filter.folderId !== null ? 1 : 0) +
    (filter.tagIds.length > 0 ? 1 : 0) +
    (filter.color !== null ? 1 : 0) +
    (filter.withAttachments ? 1 : 0) +
    (filter.withReminder ? 1 : 0)
  );
}

/** Trashed notes are removed for good after this long. */
export const TRASH_RETENTION_DAYS = 30;
