import { createId, type Clock } from '@/core';

import type { Attachment, AttachmentKind } from './entities';
import { DRAWING_MIME, parseDrawing, serializeDrawing, type Drawing } from './drawing';
import type {
  AttachmentRepository,
  AttachmentStorage,
  FilePicker,
  NoteRepository,
  PickedFile,
} from './ports';

export const MAX_ATTACHMENTS_PER_NOTE = 20;
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** Raised with a message that can be shown to the user as is. */
export class AttachmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AttachmentError';
  }
}

interface AttachmentUseCaseDeps {
  notes: NoteRepository;
  attachments: AttachmentRepository;
  storage: AttachmentStorage;
  picker: FilePicker;
  onChanged: () => void;
  clock: Clock;
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  [DRAWING_MIME]: 'sketch.json',
};

export function attachmentPath(noteId: string, id: string, mime: string): string {
  return `notes/${noteId}/${id}.${EXTENSIONS[mime] ?? 'bin'}`;
}

function cleanName(name: string, fallback: string): string {
  const trimmed = name.trim().replace(/[\\/]+/g, '_');
  return trimmed === '' ? fallback : trimmed.slice(0, 120);
}

export function createAttachmentUseCases({
  notes,
  attachments,
  storage,
  picker,
  onChanged,
  clock,
}: AttachmentUseCaseDeps) {
  async function ensureRoom(noteId: string): Promise<void> {
    if ((await notes.getRecord(noteId)) === null) {
      throw new AttachmentError('This note no longer exists.');
    }
    if ((await attachments.listFor(noteId)).length >= MAX_ATTACHMENTS_PER_NOTE) {
      throw new AttachmentError(`A note can have up to ${MAX_ATTACHMENTS_PER_NOTE} attachments.`);
    }
  }

  async function store(
    noteId: string,
    kind: AttachmentKind,
    name: string,
    mime: string,
    source: { copyFrom: string } | { text: string },
    durationMs: number | null,
  ): Promise<Attachment> {
    const id = createId();
    const path = attachmentPath(noteId, id, mime);
    const sizeBytes =
      'copyFrom' in source
        ? await storage.copyIn(source.copyFrom, path)
        : await storage.writeText(path, source.text);
    if (sizeBytes > MAX_ATTACHMENT_BYTES) {
      await storage.remove([path]);
      throw new AttachmentError('This file is too large. Attachments can be up to 25 MB.');
    }
    const attachment: Attachment = {
      id,
      noteId,
      kind,
      name,
      mime,
      path,
      sizeBytes,
      durationMs,
      createdAt: clock.now(),
    };
    try {
      await attachments.insert(attachment);
    } catch (error) {
      await storage.remove([path]);
      throw error;
    }
    onChanged();
    return attachment;
  }

  return {
    list(noteId: string): Promise<Attachment[]> {
      return attachments.listFor(noteId);
    },

    uriOf(attachment: Pick<Attachment, 'path'>): string {
      return storage.uriOf(attachment.path);
    },

    /** Lets the user pick an image or a PDF and attaches a copy. Null if they cancelled. */
    async pickAndAdd(noteId: string, kind: 'image' | 'pdf'): Promise<Attachment | null> {
      await ensureRoom(noteId);
      const picked: PickedFile | null = await picker.pick(
        kind === 'image' ? ['image/*'] : ['application/pdf'],
      );
      if (picked === null) {
        return null;
      }
      const isImage = picked.mime.startsWith('image/');
      if ((kind === 'image' && !isImage) || (kind === 'pdf' && picked.mime !== 'application/pdf')) {
        throw new AttachmentError(
          kind === 'image' ? 'Choose an image file.' : 'Choose a PDF file.',
        );
      }
      if (picked.sizeBytes > MAX_ATTACHMENT_BYTES) {
        throw new AttachmentError('This file is too large. Attachments can be up to 25 MB.');
      }
      return store(
        noteId,
        kind,
        cleanName(picked.name, kind === 'image' ? 'Image' : 'Document.pdf'),
        picked.mime,
        { copyFrom: picked.uri },
        null,
      );
    },

    async addRecording(
      noteId: string,
      recording: { uri: string; durationMs: number },
    ): Promise<Attachment> {
      await ensureRoom(noteId);
      const stamp = new Date(clock.now()).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      return store(
        noteId,
        'audio',
        `Voice note ${stamp}`,
        'audio/mp4',
        { copyFrom: recording.uri },
        Math.max(0, Math.round(recording.durationMs)),
      );
    },

    /** Saves a sketch, replacing an earlier version when `replaceId` is given. */
    async saveDrawing(
      noteId: string,
      drawing: Drawing,
      replaceId: string | null,
    ): Promise<Attachment> {
      const text = serializeDrawing(drawing);
      if (replaceId !== null) {
        const existing = await attachments.get(replaceId);
        if (existing === null || existing.noteId !== noteId || existing.kind !== 'drawing') {
          throw new AttachmentError('This drawing no longer exists.');
        }
        const sizeBytes = await storage.writeText(existing.path, text);
        await attachments.setSize(existing.id, sizeBytes);
        onChanged();
        return { ...existing, sizeBytes };
      }
      await ensureRoom(noteId);
      return store(noteId, 'drawing', 'Drawing', DRAWING_MIME, { text }, null);
    },

    async readDrawing(attachment: Attachment): Promise<Drawing | null> {
      try {
        return parseDrawing(await storage.readText(attachment.path));
      } catch {
        return null;
      }
    },

    async remove(id: string): Promise<void> {
      const attachment = await attachments.get(id);
      if (attachment === null) {
        return;
      }
      await storage.remove([attachment.path]);
      await attachments.delete(id);
      onChanged();
    },
  };
}

export type AttachmentUseCases = ReturnType<typeof createAttachmentUseCases>;
