import type { Folder, FolderNode, FolderWithCount } from './entities';

/** Folders nest at most this deep (a top-level folder is depth 0). */
export const MAX_FOLDER_DEPTH = 4;

function byName(a: Folder, b: Folder): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

/** Arranges folders into a tree, siblings in name order. Folders with a missing parent are roots. */
export function buildFolderTree(folders: readonly FolderWithCount[]): FolderNode[] {
  const known = new Set(folders.map((folder) => folder.id));
  const children = new Map<string | null, FolderWithCount[]>();
  for (const folder of folders) {
    const key = folder.parentId !== null && known.has(folder.parentId) ? folder.parentId : null;
    children.set(key, [...(children.get(key) ?? []), folder]);
  }

  const build = (parent: string | null, depth: number, seen: ReadonlySet<string>): FolderNode[] =>
    (children.get(parent) ?? [])
      .filter((folder) => !seen.has(folder.id))
      .sort(byName)
      .map((folder) => ({
        ...folder,
        depth,
        children: build(folder.id, depth + 1, new Set([...seen, folder.id])),
      }));
  return build(null, 0, new Set());
}

/** The tree in display order (each folder before its children). */
export function flattenFolderTree(nodes: readonly FolderNode[]): FolderNode[] {
  return nodes.flatMap((node) => [node, ...flattenFolderTree(node.children)]);
}

/** A folder's id together with the ids of everything inside it, at any depth. */
export function folderAndDescendantIds(folders: readonly Folder[], id: string): string[] {
  const found = [id];
  for (let index = 0; index < found.length; index += 1) {
    for (const folder of folders) {
      if (folder.parentId === found[index] && !found.includes(folder.id)) {
        found.push(folder.id);
      }
    }
  }
  return found;
}

/** Number of ancestors a folder has; 0 for a top-level folder or `null` (the root). */
export function depthOf(folders: readonly Folder[], id: string | null): number {
  let depth = 0;
  let current = id === null ? undefined : folders.find((folder) => folder.id === id);
  while (current?.parentId !== null && current !== undefined && depth <= folders.length) {
    depth += 1;
    const parentId: string | null = current.parentId;
    current = folders.find((folder) => folder.id === parentId);
  }
  return depth;
}

/** How many levels of folders sit below `id`, at the deepest point (0 when it has no children). */
export function heightBelow(folders: readonly Folder[], id: string): number {
  const children = folders.filter((folder) => folder.parentId === id);
  return children.length === 0
    ? 0
    : 1 + Math.max(...children.map((child) => heightBelow(folders, child.id)));
}

export type MoveProblem = 'cycle' | 'too-deep' | null;

/**
 * Whether `id` may be placed under `parentId` (null for the top level): not inside itself, and
 * without pushing it or anything below it past the nesting limit.
 */
export function moveProblem(
  folders: readonly Folder[],
  id: string | null,
  parentId: string | null,
): MoveProblem {
  if (id !== null && parentId !== null && folderAndDescendantIds(folders, id).includes(parentId)) {
    return 'cycle';
  }
  const newDepth = parentId === null ? 0 : depthOf(folders, parentId) + 1;
  const below = id === null ? 0 : heightBelow(folders, id);
  return newDepth + below > MAX_FOLDER_DEPTH ? 'too-deep' : null;
}

/** "Work / Projects / 2026" for a folder. */
export function folderPath(folders: readonly Folder[], id: string): string {
  const names: string[] = [];
  let current = folders.find((folder) => folder.id === id);
  while (current !== undefined && names.length <= folders.length) {
    names.unshift(current.name);
    const parentId: string | null = current.parentId;
    current = parentId === null ? undefined : folders.find((folder) => folder.id === parentId);
  }
  return names.join(' / ');
}
