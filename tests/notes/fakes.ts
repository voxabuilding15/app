import type {
  AttachmentStorage,
  Authenticator,
  FilePicker,
  NoteReminderScheduler,
  PickedFile,
  ScheduledNoteReminder,
  ScheduleOutcome,
} from '@/features/notes/domain/ports';

/** An in-memory stand-in for the document folder. */
export class FakeStorage implements AttachmentStorage {
  files = new Map<string, string>();
  /** Files "on the device" that `copyIn` can read, by URI. */
  sources = new Map<string, string>();

  async copyIn(sourceUri: string, path: string): Promise<number> {
    const content = this.sources.get(sourceUri);
    if (content === undefined) {
      throw new Error(`no such file: ${sourceUri}`);
    }
    this.files.set(path, content);
    return content.length;
  }
  async writeText(path: string, content: string): Promise<number> {
    this.files.set(path, content);
    return content.length;
  }
  async readText(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`no such file: ${path}`);
    }
    return content;
  }
  async remove(paths: readonly string[]): Promise<void> {
    paths.forEach((path) => this.files.delete(path));
  }
  uriOf(path: string): string {
    return `file:///docs/${path}`;
  }
}

export class FakePicker implements FilePicker {
  next: PickedFile | null = null;
  requested: (readonly string[])[] = [];
  async pick(mimeTypes: readonly string[]): Promise<PickedFile | null> {
    this.requested.push(mimeTypes);
    return this.next;
  }
}

export class FakeAuthenticator implements Authenticator {
  available = true;
  accepts = true;
  prompts: string[] = [];
  async isAvailable() {
    return this.available;
  }
  async authenticate(reason: string) {
    this.prompts.push(reason);
    return this.accepts;
  }
}

export class FakeReminders implements NoteReminderScheduler {
  active = new Map<string, ScheduledNoteReminder>();
  cancelled: string[] = [];
  blocked = false;
  private counter = 0;
  async schedule(reminder: ScheduledNoteReminder): Promise<ScheduleOutcome> {
    if (this.blocked) {
      return { status: 'blocked' };
    }
    this.counter += 1;
    const id = `n${this.counter}`;
    this.active.set(id, reminder);
    return { status: 'scheduled', notificationId: id };
  }
  async cancel(id: string) {
    this.cancelled.push(id);
    this.active.delete(id);
  }
}
