import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { FileArea, FileService, PickedDeviceFile, StoredFile } from '@/core';

function fileAt(area: FileArea, path: string): File {
  return new File(area === 'cache' ? Paths.cache : Paths.document, path);
}

function describe(area: FileArea, path: string, file: File): StoredFile {
  return {
    uri: file.uri,
    path,
    name: file.name,
    sizeBytes: file.size,
    modifiedAt: file.modificationTime ?? 0,
  };
}

function prepare(area: FileArea, path: string): File {
  const file = fileAt(area, path);
  new Directory(file.parentDirectory.uri).create({ intermediates: true, idempotent: true });
  file.create({ overwrite: true });
  return file;
}

class DeviceFileService implements FileService {
  async writeText(area: FileArea, path: string, content: string): Promise<StoredFile> {
    const file = prepare(area, path);
    file.write(content);
    return describe(area, path, file);
  }

  async writeBytes(area: FileArea, path: string, bytes: Uint8Array): Promise<StoredFile> {
    const file = prepare(area, path);
    file.write(bytes);
    return describe(area, path, file);
  }

  readText(area: FileArea, path: string): Promise<string> {
    return fileAt(area, path).text();
  }

  async list(area: FileArea, folder: string): Promise<StoredFile[]> {
    const directory = new Directory(area === 'cache' ? Paths.cache : Paths.document, folder);
    if (!directory.exists) {
      return [];
    }
    return directory
      .list()
      .filter((entry): entry is File => entry instanceof File)
      .map((file) => describe(area, `${folder}/${file.name}`, file))
      .sort((a, b) => b.modifiedAt - a.modifiedAt || b.name.localeCompare(a.name));
  }

  async exists(area: FileArea, path: string): Promise<boolean> {
    return fileAt(area, path).exists;
  }

  async remove(area: FileArea, path: string): Promise<void> {
    const file = fileAt(area, path);
    if (file.exists) {
      file.delete();
    }
  }

  readPickedText(uri: string): Promise<string> {
    return new File(uri).text();
  }

  async readBase64(area: FileArea, path: string): Promise<string | null> {
    const file = fileAt(area, path);
    return file.exists ? file.base64() : null;
  }

  async writeBase64(area: FileArea, path: string, base64: string): Promise<void> {
    const file = prepare(area, path);
    file.write(base64, { encoding: 'base64' });
  }

  async share(file: StoredFile, mimeType: string, title: string): Promise<boolean> {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: title });
        return true;
      }
    } catch {
      // Falls through: nothing could take the file.
    }
    return false;
  }

  async pick(mimeTypes: readonly string[]): Promise<PickedDeviceFile | null> {
    const picked = await File.pickFileAsync({ mimeTypes: [...mimeTypes] });
    if (picked.canceled) {
      return null;
    }
    const { uri, name, size } = picked.result;
    return { uri, name, sizeBytes: size };
  }
}

export const fileService: FileService = new DeviceFileService();
