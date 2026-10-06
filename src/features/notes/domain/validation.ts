export const TITLE_MAX_LENGTH = 200;
export const BODY_MAX_LENGTH = 100_000;
export const FOLDER_NAME_MAX_LENGTH = 40;
const COLOR = /^#[0-9a-fA-F]{6}$/;

export interface NoteDraft {
  title: string;
  /** Markdown. */
  body: string;
  folderId: string | null;
  /** A `#RRGGBB` color, or null for none. */
  color: string | null;
  tagIds: string[];
  /** Epoch ms of the reminder, or null. */
  reminderAt: number | null;
  pinned: boolean;
  favorite: boolean;
  locked: boolean;
}

type NoteDraftField = 'title' | 'body' | 'content' | 'color' | 'reminder' | 'folder';
export type NoteErrors = Partial<Record<NoteDraftField, string>>;

export function emptyNoteDraft(folderId: string | null = null): NoteDraft {
  return {
    title: '',
    body: '',
    folderId,
    color: null,
    tagIds: [],
    reminderAt: null,
    pinned: false,
    favorite: false,
    locked: false,
  };
}

export function validateNote(draft: NoteDraft): NoteErrors {
  const errors: NoteErrors = {};
  if (draft.title.length > TITLE_MAX_LENGTH) {
    errors.title = `Titles can have up to ${TITLE_MAX_LENGTH} characters`;
  }
  if (draft.body.length > BODY_MAX_LENGTH) {
    errors.body = `Notes can have up to ${BODY_MAX_LENGTH.toLocaleString('en-US')} characters`;
  }
  if (draft.color !== null && !COLOR.test(draft.color)) {
    errors.color = 'Choose a valid color';
  }
  if (draft.reminderAt !== null && !Number.isFinite(draft.reminderAt)) {
    errors.reminder = 'Choose a valid time';
  }
  return errors;
}

export interface FolderDraft {
  name: string;
  parentId: string | null;
}

export interface FolderErrors {
  name?: string;
  parent?: string;
}

export function validateFolder(draft: FolderDraft): FolderErrors {
  const errors: FolderErrors = {};
  const name = draft.name.trim();
  if (name.length === 0) {
    errors.name = 'Enter a name';
  } else if (name.length > FOLDER_NAME_MAX_LENGTH) {
    errors.name = `Use ${FOLDER_NAME_MAX_LENGTH} characters or fewer`;
  }
  return errors;
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}
