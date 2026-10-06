import type { FileArea, FileService, PickedDeviceFile, StoredFile } from '@/core';

interface Entry {
  bytes: Uint8Array;
  modifiedAt: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** An in-memory stand-in for the device's files and share sheet. */
export class MemoryFiles implements FileService {
  entries = new Map<string, Entry>();
  shared: { file: StoredFile; mimeType: string }[] = [];
  canShare = true;
  /** What `pick` returns next. */
  next: PickedDeviceFile | null = null;
  clock = 1;

  private key = (area: FileArea, path: string) => `${area}:${path}`;

  private store(area: FileArea, path: string, bytes: Uint8Array): StoredFile {
    this.clock += 1;
    this.entries.set(this.key(area, path), { bytes, modifiedAt: this.clock });
    return this.describe(area, path);
  }

  private describe(area: FileArea, path: string): StoredFile {
    const entry = this.entries.get(this.key(area, path));
    return {
      uri: `file:///${area}/${path}`,
      path,
      name: path.split('/').pop() ?? path,
      sizeBytes: entry?.bytes.length ?? 0,
      modifiedAt: entry?.modifiedAt ?? 0,
    };
  }

  async writeText(area: FileArea, path: string, content: string) {
    return this.store(area, path, encoder.encode(content));
  }
  async writeBytes(area: FileArea, path: string, bytes: Uint8Array) {
    return this.store(area, path, bytes);
  }
  async readText(area: FileArea, path: string) {
    const entry = this.entries.get(this.key(area, path));
    if (entry === undefined) {
      throw new Error(`no such file: ${path}`);
    }
    return decoder.decode(entry.bytes);
  }
  async list(area: FileArea, folder: string) {
    return [...this.entries.keys()]
      .filter(
        (key) =>
          key.startsWith(`${area}:${folder}/`) &&
          !key.slice(area.length + folder.length + 2).includes('/'),
      )
      .map((key) => this.describe(area, key.slice(area.length + 1)))
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
  }
  async exists(area: FileArea, path: string) {
    return this.entries.has(this.key(area, path));
  }
  async remove(area: FileArea, path: string) {
    this.entries.delete(this.key(area, path));
  }
  async readPickedText(uri: string) {
    const match = [...this.entries.keys()].find(
      (key) => uri === `file:///${key.replace(':', '/')}`,
    );
    if (match === undefined) {
      throw new Error(`no such file: ${uri}`);
    }
    return decoder.decode(this.entries.get(match)?.bytes ?? new Uint8Array());
  }
  async readBase64(area: FileArea, path: string) {
    const entry = this.entries.get(this.key(area, path));
    return entry === undefined ? null : Buffer.from(entry.bytes).toString('base64');
  }
  async writeBase64(area: FileArea, path: string, base64: string) {
    this.store(area, path, new Uint8Array(Buffer.from(base64, 'base64')));
  }
  async share(file: StoredFile, mimeType: string) {
    if (!this.canShare) {
      return false;
    }
    this.shared.push({ file, mimeType });
    return true;
  }
  async pick() {
    return this.next;
  }
}
