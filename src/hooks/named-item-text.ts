import { msg } from '@/i18n/msg';

export type NamedItemKind = 'category' | 'label' | 'tag';

/**
 * The words around categories, labels and tags, written out in full for each so every language
 * can use its own grammar instead of slotting a noun into a sentence.
 */
export const NAMED_ITEM_TEXT = {
  category: {
    loadError: msg("Couldn't load categories"),
    empty: msg('No categories yet'),
    add: msg('Add category'),
    edit: msg('Edit category'),
    create: msg('New category'),
    confirmTitle: msg('Delete category "{name}"?'),
    confirmMessage: msg('Items keep existing; they just lose this category.'),
  },
  label: {
    loadError: msg("Couldn't load labels"),
    empty: msg('No labels yet'),
    add: msg('Add label'),
    edit: msg('Edit label'),
    create: msg('New label'),
    confirmTitle: msg('Delete label "{name}"?'),
    confirmMessage: msg('Items keep existing; they just lose this label.'),
  },
  tag: {
    loadError: msg("Couldn't load tags"),
    empty: msg('No tags yet'),
    add: msg('Add tag'),
    edit: msg('Edit tag'),
    create: msg('New tag'),
    confirmTitle: msg('Delete tag "{name}"?'),
    confirmMessage: msg('Items keep existing; they just lose this tag.'),
  },
} as const;
