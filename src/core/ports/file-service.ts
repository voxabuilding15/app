/** Where a file lives: `cache` can be cleared by the system, `documents` is kept with the app. */
export type FileArea = 'cache' | 'documents';

export interface StoredFile {
  uri: string;
  /** Path below the area, with `/` separators. */
  path: string;
  name: string;
  sizeBytes: number;
  /** Last change, epoch ms. */
  modifiedAt: number;
}

export interface PickedFile {
  uri: string;
  name: string;
  sizeBytes: number;
}

/** Files the app writes itself (exports, backups) and the hand-off to other apps. */
export interface FileService {
  writeText(area: FileArea, path: string, content: string): Promise<StoredFile>;
  writeBytes(area: FileArea, path: string, bytes: Uint8Array): Promise<StoredFile>;
  readText(area: FileArea, path: string): Promise<string>;
  /** Files directly inside a folder, newest first. A missing folder is empty. */
  list(area: FileArea, folder: string): Promise<StoredFile[]>;
  exists(area: FileArea, path: string): Promise<boolean>;
  remove(area: FileArea, path: string): Promise<void>;
  /** Reads a file the user picked with `pick`. */
  readPickedText(uri: string): Promise<string>;
  /** Base64 of a file inside the area, or null when it is missing. */
  readBase64(area: FileArea, path: string): Promise<string | null>;
  writeBase64(area: FileArea, path: string, base64: string): Promise<void>;
  /** Hands a file to the system share sheet. Resolves to false when nothing can open it. */
  share(file: StoredFile, mimeType: string, title: string): Promise<boolean>;
  /** Opens the system file chooser; null when cancelled. */
  pick(mimeTypes: readonly string[]): Promise<PickedFile | null>;
}
