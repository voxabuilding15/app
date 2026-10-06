import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { pickDate, pickTime, showRemindersBlockedAlert } from '@/components';
import { combineDayAndTime, startOfDay } from '@/core';
import { useDiscardGuard, useNow } from '@/hooks';

import { AttachmentError } from '../../domain/attachment-usecases';
import type { Drawing } from '../../domain/drawing';
import type { Attachment, AttachmentKind, NoteDetail } from '../../domain/entities';
import {
  applyBlock,
  applyInline,
  continueList,
  typedNewlineCaret,
  type BlockFormat,
  type InlineFormat,
  type Selection,
} from '../../domain/formatting';
import { toggleTask } from '../../domain/markdown';
import { emptyNoteDraft, type NoteDraft, type NoteErrors } from '../../domain/validation';
import { useNotesModule } from '../module';
import { openFile } from '../open-file';
import { useAttachments, useInvalidateNotes, useNote, useTags } from '../queries';

const DEFAULT_REMINDER_HOUR = 9;

export interface NewNoteDefaults {
  folderId: string | null;
}

function draftFromNote(note: NoteDetail): NoteDraft {
  return {
    title: note.title,
    body: note.body,
    folderId: note.folder?.id ?? null,
    color: note.color,
    tagIds: note.tags.map((tag) => tag.id),
    reminderAt: note.reminderAt,
    pinned: note.pinned,
    favorite: note.favorite,
    locked: note.locked,
  };
}

export type NoteLoadState =
  | { phase: 'loading' }
  | { phase: 'notFound' }
  | { phase: 'failed'; retry: () => void }
  | { phase: 'ready'; initial: NoteDraft; note: NoteDetail | null };

/** Loads the note to edit, or builds the starting draft for a new one. */
export function useNoteLoader(noteId: string | null, defaults: NewNoteDefaults): NoteLoadState {
  const query = useNote(noteId);
  const { data } = query;
  const initial = useMemo(
    () => (data ? draftFromNote(data) : emptyNoteDraft(defaults.folderId)),
    [data, defaults.folderId],
  );

  if (noteId === null) {
    return { phase: 'ready', initial, note: null };
  }
  if (query.isPending) {
    return { phase: 'loading' };
  }
  if (query.isError) {
    return { phase: 'failed', retry: () => void query.refetch() };
  }
  return data ? { phase: 'ready', initial, note: data } : { phase: 'notFound' };
}

export type EditorMode = 'edit' | 'preview';

/** What the editor is showing on top of the note, if anything. */
export type EditorOverlay =
  | { kind: 'recorder' }
  | { kind: 'drawing'; attachment: Attachment | null; initial: Drawing | null }
  | { kind: 'image'; attachment: Attachment }
  | null;

/** Editing state for one note. `noteId` null creates a new one on first save. */
export function useNoteEditorViewModel(noteId: string | null, initial: NoteDraft) {
  const router = useRouter();
  const { notes, attachments: attachmentCases, lock, tags: tagCases } = useNotesModule();
  const invalidate = useInvalidateNotes();
  const now = useNow();
  const tags = useTags();

  const [id, setId] = useState(noteId);
  const [draft, setDraft] = useState<NoteDraft>(initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial));
  const [errors, setErrors] = useState<NoteErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>('edit');
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const [overlay, setOverlay] = useState<EditorOverlay>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);

  const attachmentList = useAttachments(id);
  const isDirty = useMemo(() => JSON.stringify(draft) !== baseline, [draft, baseline]);
  const allowLeaving = useDiscardGuard(isDirty, saving);

  const update = useCallback(
    (changes: Partial<NoteDraft>, clears: readonly (keyof NoteErrors)[] = []) => {
      setDraft((current) => ({ ...current, ...changes }));
      setSaveError(null);
      if (clears.length > 0) {
        setErrors((current) => {
          const next = { ...current };
          clears.forEach((field) => delete next[field]);
          return next;
        });
      }
    },
    [],
  );

  const finish = useCallback(() => {
    allowLeaving();
    router.back();
  }, [allowLeaving, router]);

  // --- Text ------------------------------------------------------------------------------------

  const setBody = useCallback(
    (text: string) => {
      const caret = typedNewlineCaret(draft.body, text);
      const continued = caret === null ? null : continueList(draft.body, text, caret);
      update({ body: continued?.text ?? text }, ['body', 'content']);
      if (continued) {
        setSelection(continued.selection);
      }
    },
    [draft.body, update],
  );

  const formatInline = useCallback(
    (format: InlineFormat) => {
      const result = applyInline(draft.body, selection, format);
      update({ body: result.text }, ['body', 'content']);
      setSelection(result.selection);
    },
    [draft.body, selection, update],
  );

  const formatBlock = useCallback(
    (format: BlockFormat) => {
      const result = applyBlock(draft.body, selection, format);
      update({ body: result.text }, ['body', 'content']);
      setSelection(result.selection);
    },
    [draft.body, selection, update],
  );

  const tickTask = useCallback(
    (line: number) => update({ body: toggleTask(draft.body, line) }),
    [draft.body, update],
  );

  // --- Details ---------------------------------------------------------------------------------

  const toggleTag = useCallback(
    (tagId: string) =>
      update({
        tagIds: draft.tagIds.includes(tagId)
          ? draft.tagIds.filter((existing) => existing !== tagId)
          : [...draft.tagIds, tagId],
      }),
    [draft.tagIds, update],
  );

  const createTag = useCallback(
    async (name: string, color: string): Promise<string | null> => {
      try {
        const result = await tagCases.save({ id: null, name, color });
        if (!result.ok) {
          return result.error;
        }
        await invalidate();
        update({ tagIds: [...draft.tagIds, result.id] });
        return null;
      } catch {
        return "Couldn't save. Please try again.";
      }
    },
    [tagCases, invalidate, update, draft.tagIds],
  );

  const pickReminderDay = useCallback(async () => {
    const current = draft.reminderAt ?? now + 3_600_000;
    const picked = await pickDate(new Date(current));
    if (picked === null) {
      return;
    }
    const time =
      draft.reminderAt ?? startOfDay(picked.getTime()) + DEFAULT_REMINDER_HOUR * 3_600_000;
    update({ reminderAt: combineDayAndTime(picked.getTime(), time) }, ['reminder']);
  }, [draft.reminderAt, now, update]);

  const pickReminderTime = useCallback(async () => {
    if (draft.reminderAt === null) {
      return;
    }
    const picked = await pickTime(new Date(draft.reminderAt));
    if (picked !== null) {
      update({ reminderAt: combineDayAndTime(draft.reminderAt, picked.getTime()) }, ['reminder']);
    }
  }, [draft.reminderAt, update]);

  /** Locking needs a lock method; returns false (and does nothing) until one is set up. */
  const setLocked = useCallback(
    (locked: boolean): boolean => {
      if (locked && lock.method() === 'none') {
        return false;
      }
      update({ locked });
      return true;
    },
    [lock, update],
  );

  // --- Saving ----------------------------------------------------------------------------------

  const save = useCallback(
    async (andClose = true): Promise<string | null> => {
      if (saving) {
        return null;
      }
      setSaving(true);
      setSaveError(null);
      try {
        const result = await notes.save(draft, id);
        if (!result.ok) {
          setErrors(result.errors);
          return null;
        }
        setId(result.id);
        setBaseline(JSON.stringify(draft));
        await invalidate();
        if (result.reminder === 'blocked') {
          showRemindersBlockedAlert();
        }
        if (andClose) {
          finish();
        }
        return result.id;
      } catch {
        setSaveError("Couldn't save the note. Please try again.");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [saving, notes, draft, id, invalidate, finish],
  );

  /** Attachments belong to a saved note, so a brand-new note is saved first. */
  const ensureSaved = useCallback(async (): Promise<string | null> => {
    if (id !== null) {
      return id;
    }
    if (draft.title.trim() === '' && draft.body.trim() === '') {
      update({ title: 'Untitled' });
      const result = await notes.save({ ...draft, title: 'Untitled' }, null);
      if (!result.ok) {
        return null;
      }
      setId(result.id);
      setBaseline(JSON.stringify({ ...draft, title: 'Untitled' }));
      return result.id;
    }
    return save(false);
  }, [id, draft, notes, save, update]);

  // --- Attachments -----------------------------------------------------------------------------

  const attach = useCallback(
    async (action: (noteId: string) => Promise<unknown>) => {
      setAttachmentError(null);
      setAttaching(true);
      try {
        const target = await ensureSaved();
        if (target !== null) {
          await action(target);
        }
      } catch (error) {
        setAttachmentError(
          error instanceof AttachmentError ? error.message : "Couldn't add the attachment.",
        );
      } finally {
        setAttaching(false);
        await invalidate();
      }
    },
    [ensureSaved, invalidate],
  );

  const addAttachment = useCallback(
    async (kind: AttachmentKind) => {
      if (kind === 'audio') {
        setOverlay({ kind: 'recorder' });
      } else if (kind === 'drawing') {
        setOverlay({ kind: 'drawing', attachment: null, initial: null });
      } else {
        await attach((target) => attachmentCases.pickAndAdd(target, kind));
      }
    },
    [attach, attachmentCases],
  );

  const saveRecording = useCallback(
    async (recording: { uri: string; durationMs: number }) => {
      setOverlay(null);
      await attach((target) => attachmentCases.addRecording(target, recording));
    },
    [attach, attachmentCases],
  );

  const saveDrawing = useCallback(
    async (drawing: Drawing) => {
      const replacing = overlay?.kind === 'drawing' ? overlay.attachment : null;
      setOverlay(null);
      await attach((target) => attachmentCases.saveDrawing(target, drawing, replacing?.id ?? null));
    },
    [attach, attachmentCases, overlay],
  );

  const openAttachment = useCallback(
    async (attachment: Attachment) => {
      switch (attachment.kind) {
        case 'image':
          setOverlay({ kind: 'image', attachment });
          break;
        case 'pdf':
          await openFile(attachmentCases.uriOf(attachment), attachment.mime);
          break;
        case 'drawing':
          setOverlay({
            kind: 'drawing',
            attachment,
            initial: await attachmentCases.readDrawing(attachment),
          });
          break;
        default:
          break;
      }
    },
    [attachmentCases],
  );

  const removeAttachment = useCallback(
    (attachment: Attachment) =>
      Alert.alert(`Remove ${attachment.name}?`, 'The file is deleted from this note.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            void attachmentCases
              .remove(attachment.id)
              .catch(() => setAttachmentError("Couldn't remove the attachment."))
              .finally(() => void invalidate()),
        },
      ]),
    [attachmentCases, invalidate],
  );

  // --- Note actions ----------------------------------------------------------------------------

  const archive = useCallback(async () => {
    if (id === null) {
      return;
    }
    try {
      await notes.archive([id]);
      await invalidate();
      finish();
    } catch {
      setSaveError("Couldn't archive the note.");
    }
  }, [id, notes, invalidate, finish]);

  const trash = useCallback(async () => {
    if (id === null) {
      return;
    }
    try {
      await notes.trash([id]);
      await invalidate();
      finish();
    } catch {
      setSaveError("Couldn't move the note to the trash.");
    }
  }, [id, notes, invalidate, finish]);

  const restore = useCallback(async () => {
    if (id === null) {
      return;
    }
    try {
      await notes.restore([id]);
      await notes.unarchive([id]);
      await invalidate();
      finish();
    } catch {
      setSaveError("Couldn't restore the note.");
    }
  }, [id, notes, invalidate, finish]);

  const confirmTrash = useCallback(
    () =>
      Alert.alert('Move to the trash?', 'You can restore it from the trash for 30 days.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Move to trash', style: 'destructive', onPress: () => void trash() },
      ]),
    [trash],
  );

  return {
    isEditing: id !== null,
    now,
    draft,
    errors,
    saving,
    saveError,
    isDirty,
    mode,
    setMode,
    selection,
    setSelection,
    tags: tags.data ?? [],
    attachments: attachmentList.data ?? [],
    attaching,
    attachmentError,
    overlay,
    closeOverlay: useCallback(() => setOverlay(null), []),
    setTitle: useCallback((title: string) => update({ title }, ['title', 'content']), [update]),
    setBody,
    formatInline,
    formatBlock,
    tickTask,
    setFolder: useCallback((folderId: string | null) => update({ folderId }, ['folder']), [update]),
    setColor: useCallback((color: string | null) => update({ color }, ['color']), [update]),
    setPinned: useCallback((pinned: boolean) => update({ pinned }), [update]),
    setFavorite: useCallback((favorite: boolean) => update({ favorite }), [update]),
    setLocked,
    toggleTag,
    createTag,
    pickReminderDay,
    pickReminderTime,
    clearReminder: useCallback(() => update({ reminderAt: null }, ['reminder']), [update]),
    save,
    addAttachment,
    saveRecording,
    saveDrawing,
    openAttachment,
    removeAttachment,
    uriOf: attachmentCases.uriOf,
    loadDrawing: attachmentCases.readDrawing,
    archive,
    restore,
    confirmTrash,
  };
}
