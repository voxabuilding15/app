import { Directory, File, Paths } from 'expo-file-system';

import type { AttachmentStorage } from '../domain/ports';

function fileAt(path: string): File {
  return new File(Paths.document, path);
}

/** Keeps attachments in the app's document folder, which the system never clears on its own. */
export class DocumentAttachmentStorage implements AttachmentStorage {
  async copyIn(sourceUri: string, path: string): Promise<number> {
    const target = fileAt(path);
    new Directory(target.parentDirectory.uri).create({ intermediates: true, idempotent: true });
    await new File(sourceUri).copy(target, { overwrite: true });
    return target.size;
  }

  async writeText(path: string, content: string): Promise<number> {
    const target = fileAt(path);
    target.create({ intermediates: true, overwrite: true });
    target.write(content);
    return target.size;
  }

  readText(path: string): Promise<string> {
    return fileAt(path).text();
  }

  async remove(paths: readonly string[]): Promise<void> {
    for (const path of paths) {
      const file = fileAt(path);
      if (file.exists) {
        file.delete();
      }
      // Drop the note's folder once its last file is gone.
      const folder = file.parentDirectory;
      if (folder.exists && folder.list().length === 0) {
        folder.delete();
      }
    }
  }

  uriOf(path: string): string {
    return fileAt(path).uri;
  }
}
