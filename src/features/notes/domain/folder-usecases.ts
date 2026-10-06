import { createId, type Clock } from '@/core';

import type { FolderNode, FolderWithCount } from './entities';
import { buildFolderTree, moveProblem } from './folders';
import type { FolderRepository } from './ports';
import { hasErrors, validateFolder, type FolderDraft, type FolderErrors } from './validation';
import { currentTranslator } from '@/i18n/translate';

export type SaveFolderResult = { ok: true; id: string } | { ok: false; errors: FolderErrors };

interface FolderUseCaseDeps {
  folders: FolderRepository;
  clock: Clock;
}

export function createFolderUseCases({ folders, clock }: FolderUseCaseDeps) {
  const { t } = currentTranslator();
  return {
    list(): Promise<FolderWithCount[]> {
      return folders.list();
    },

    async tree(): Promise<FolderNode[]> {
      return buildFolderTree(await folders.list());
    },

    async save(draft: FolderDraft, id: string | null): Promise<SaveFolderResult> {
      const errors = validateFolder(draft);
      const all = await folders.list();
      const name = draft.name.trim();

      if (id !== null && !all.some((folder) => folder.id === id)) {
        throw new Error(t('This folder no longer exists.'));
      }
      if (draft.parentId !== null && !all.some((folder) => folder.id === draft.parentId)) {
        errors.parent = t('This folder no longer exists');
      } else {
        const problem = moveProblem(all, id, draft.parentId);
        if (problem === 'cycle') {
          errors.parent = t('A folder cannot be moved inside itself');
        } else if (problem === 'too-deep') {
          errors.parent = t('Folders can only be nested a few levels deep');
        }
      }
      if (
        !errors.name &&
        all.some(
          (other) =>
            other.id !== id &&
            other.parentId === draft.parentId &&
            other.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        errors.name = t('A folder with this name already exists here');
      }
      if (hasErrors(errors)) {
        return { ok: false, errors };
      }

      if (id === null) {
        const folder = { id: createId(), name, parentId: draft.parentId, createdAt: clock.now() };
        await folders.insert(folder);
        return { ok: true, id: folder.id };
      }
      await folders.update(id, name, draft.parentId);
      return { ok: true, id };
    },

    /**
     * Deletes a folder. Its notes and subfolders move up to its parent, so nothing is lost.
     * Returns where they went (null is the top level).
     */
    async remove(id: string): Promise<string | null> {
      const folder = await folders.get(id);
      if (folder === null) {
        throw new Error(t('This folder no longer exists.'));
      }
      const target = folder.parentId;
      // A sibling with the same name as a child would clash once the child moves up.
      const all = await folders.list();
      const siblings = all.filter((other) => other.parentId === target && other.id !== id);
      const clash = all
        .filter((child) => child.parentId === id)
        .find((child) =>
          siblings.some((sibling) => sibling.name.toLowerCase() === child.name.toLowerCase()),
        );
      if (clash !== undefined) {
        throw new Error(
          t('A folder named "{name}" already exists in the destination.', { name: clash.name }),
        );
      }
      await folders.moveContents(id, target);
      await folders.delete(id);
      return target;
    },
  };
}

export type FolderUseCases = ReturnType<typeof createFolderUseCases>;
