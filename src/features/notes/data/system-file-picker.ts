import { File } from 'expo-file-system';

import type { FilePicker, PickedFile } from '../domain/ports';

/** Opens the system file chooser. Nothing is read until the user picks something. */
export class SystemFilePicker implements FilePicker {
  async pick(mimeTypes: readonly string[]): Promise<PickedFile | null> {
    const picked = await File.pickFileAsync({ mimeTypes: [...mimeTypes] });
    if (picked.canceled) {
      return null;
    }
    const file = picked.result;
    return { uri: file.uri, name: file.name, mime: file.type, sizeBytes: file.size };
  }
}
