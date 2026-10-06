import { createId } from './ids';

/** A user-defined named, colored group (categories, labels). */
export interface Category {
  id: string;
  name: string;
  color: string;
}

export type CategoryKind = 'task' | 'habit' | 'event' | 'expense' | 'income' | 'note' | 'pomodoro';

export const NAME_MAX_LENGTH = 30;

/** Filter sentinel meaning "items without a category". */
export const NO_CATEGORY = '__none__';

export interface CategoryRepository {
  list(): Promise<Category[]>;
  save(category: Category): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface NamedInput {
  id: string | null;
  name: string;
  color: string;
}

export type SaveNameResult = { ok: true; id: string } | { ok: false; error: string };

/** Validates a category or label name. Returns an error message or null. */
function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'Enter a name';
  }
  return trimmed.length > NAME_MAX_LENGTH ? `Use ${NAME_MAX_LENGTH} characters or fewer` : null;
}

/** Validates, rejects case-insensitive duplicates, then persists a named item. */
async function saveNamedItem(
  input: NamedInput,
  existing: readonly Category[],
  persist: (item: Category) => Promise<void>,
): Promise<SaveNameResult> {
  const error = validateName(input.name);
  if (error !== null) {
    return { ok: false, error };
  }
  const name = input.name.trim();
  const duplicate = existing.some(
    (item) => item.id !== input.id && item.name.toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) {
    return { ok: false, error: 'This name is already in use' };
  }
  const id = input.id ?? createId();
  await persist({ id, name, color: input.color });
  return { ok: true, id };
}

/** Use cases shared by every feature that groups its items into categories. */
export function createCategoryUseCases(repository: CategoryRepository) {
  return {
    list: () => repository.list(),
    async save(input: NamedInput): Promise<SaveNameResult> {
      return saveNamedItem(input, await repository.list(), (item) => repository.save(item));
    },
    delete: (id: string) => repository.delete(id),
  };
}
