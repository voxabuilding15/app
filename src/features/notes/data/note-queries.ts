import type { NoteQuery, NoteSort } from '../domain/filters';

/** Columns every note query reads. Locked notes never expose their text or checklist counts. */
export const SELECT_SUMMARY = `
  SELECT n.id, n.title,
    CASE WHEN n.locked = 1 THEN '' ELSE substr(n.body, 1, 600) END AS body_preview,
    n.color, n.pinned, n.favorite, n.locked, n.archived_at, n.deleted_at, n.reminder_at,
    n.created_at, n.updated_at, f.id AS folder_id, f.name AS folder_name,
    (SELECT COUNT(*) FROM note_attachments a WHERE a.note_id = n.id) AS attachment_count,
    CASE WHEN n.locked = 1 THEN 0 ELSE
      (length(n.body) - length(replace(n.body, '- [ ] ', ''))) / 6
      + (length(n.body) - length(replace(n.body, '- [x] ', ''))) / 6 END AS check_total,
    CASE WHEN n.locked = 1 THEN 0 ELSE
      (length(n.body) - length(replace(n.body, '- [x] ', ''))) / 6 END AS check_done
  FROM notes n LEFT JOIN folders f ON f.id = n.folder_id`;

export function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

/** Escapes LIKE wildcards so searching for "50%" matches the text, not everything. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

interface Where {
  sql: string;
  params: (string | number)[];
}

export function buildWhere(query: NoteQuery): Where {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  switch (query.scope) {
    case 'favorites':
      clauses.push('n.favorite = 1 AND n.archived_at IS NULL AND n.deleted_at IS NULL');
      break;
    case 'archived':
      clauses.push('n.archived_at IS NOT NULL AND n.deleted_at IS NULL');
      break;
    case 'trash':
      clauses.push('n.deleted_at IS NOT NULL');
      break;
    default:
      clauses.push('n.archived_at IS NULL AND n.deleted_at IS NULL');
  }
  if (query.search !== '') {
    const pattern = likePattern(query.search);
    // A locked note's text is not searchable, so search cannot be used to read it.
    clauses.push(
      `(n.title LIKE ? ESCAPE '\\' OR (n.locked = 0 AND n.body LIKE ? ESCAPE '\\')
        OR EXISTS (SELECT 1 FROM note_tags nt JOIN categories c ON c.id = nt.category_id
                   WHERE nt.note_id = n.id AND c.name LIKE ? ESCAPE '\\'))`,
    );
    params.push(pattern, pattern, pattern);
  }
  if (query.folderIds !== null) {
    clauses.push(`n.folder_id IN (${placeholders(query.folderIds.length)})`);
    params.push(...query.folderIds);
  }
  if (query.withoutFolder) {
    clauses.push('n.folder_id IS NULL');
  }
  if (query.tagIds.length > 0) {
    clauses.push(
      `EXISTS (SELECT 1 FROM note_tags nt WHERE nt.note_id = n.id AND nt.category_id IN (${placeholders(query.tagIds.length)}))`,
    );
    params.push(...query.tagIds);
  }
  if (query.color !== null) {
    clauses.push('n.color = ?');
    params.push(query.color);
  }
  if (query.withAttachments) {
    clauses.push('EXISTS (SELECT 1 FROM note_attachments a WHERE a.note_id = n.id)');
  }
  if (query.withReminder) {
    clauses.push('n.reminder_at IS NOT NULL');
  }
  return { sql: clauses.join(' AND '), params };
}

/** Pinned notes lead the main lists; within each group the chosen sort applies. */
export function buildOrderBy(sort: NoteSort, scope: NoteQuery['scope']): string {
  const direction = sort.direction === 'asc' ? 'ASC' : 'DESC';
  const pinned = scope === 'notes' || scope === 'favorites' ? 'n.pinned DESC, ' : '';
  const field =
    sort.field === 'title'
      ? `(n.title = '') ASC, n.title COLLATE NOCASE ${direction}`
      : sort.field === 'created'
        ? `n.created_at ${direction}`
        : `n.updated_at ${direction}`;
  return `${pinned}${field}, n.updated_at DESC, n.rowid DESC`;
}
