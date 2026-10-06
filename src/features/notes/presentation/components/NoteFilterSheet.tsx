import { View } from 'react-native';

import { Button, Chip, ChipGroup, Sheet } from '@/components';
import type { Category } from '@/core';
import { ACCENT_COLORS, spacing } from '@/theme';

import type { FolderWithCount } from '../../domain/entities';
import { NO_FOLDER, type NoteFilter } from '../../domain/filters';
import { folderPath } from '../../domain/folders';

interface NoteFilterSheetProps {
  visible: boolean;
  filter: NoteFilter;
  folders: readonly FolderWithCount[];
  tags: readonly Category[];
  onChange: (changes: Partial<Omit<NoteFilter, 'scope' | 'search'>>) => void;
  onReset: () => void;
  onClose: () => void;
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function NoteFilterSheet({
  visible,
  filter,
  folders,
  tags,
  onChange,
  onReset,
  onClose,
}: NoteFilterSheetProps) {
  const ordered = [...folders].sort((a, b) =>
    folderPath(folders, a.id).localeCompare(folderPath(folders, b.id), undefined, {
      sensitivity: 'base',
    }),
  );

  return (
    <Sheet visible={visible} title="Filter notes" onClose={onClose}>
      <ChipGroup title="Folder">
        <Chip
          label="Any"
          selected={filter.folderId === null}
          onPress={() => onChange({ folderId: null })}
        />
        <Chip
          label="No folder"
          selected={filter.folderId === NO_FOLDER}
          onPress={() => onChange({ folderId: NO_FOLDER })}
        />
        {ordered.map((folder) => (
          <Chip
            key={folder.id}
            label={folderPath(folders, folder.id)}
            selected={filter.folderId === folder.id}
            onPress={() => onChange({ folderId: folder.id })}
          />
        ))}
      </ChipGroup>
      {tags.length > 0 ? (
        <ChipGroup title="Tags (any of)">
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              label={tag.name}
              dotColor={tag.color}
              selected={filter.tagIds.includes(tag.id)}
              onPress={() => onChange({ tagIds: toggle(filter.tagIds, tag.id) })}
            />
          ))}
        </ChipGroup>
      ) : null}
      <ChipGroup title="Color">
        <Chip
          label="Any"
          selected={filter.color === null}
          onPress={() => onChange({ color: null })}
        />
        {ACCENT_COLORS.map((color, index) => (
          <Chip
            key={color}
            label={`Color ${index + 1}`}
            dotColor={color}
            selected={filter.color === color}
            onPress={() => onChange({ color })}
          />
        ))}
      </ChipGroup>
      <ChipGroup title="Only notes with">
        <Chip
          icon="attach-file"
          label="Attachments"
          selected={filter.withAttachments}
          onPress={() => onChange({ withAttachments: !filter.withAttachments })}
        />
        <Chip
          icon="notifications-none"
          label="Reminder"
          selected={filter.withReminder}
          onPress={() => onChange({ withReminder: !filter.withReminder })}
        />
      </ChipGroup>
      <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' }}>
        <Button label="Reset" variant="outlined" onPress={onReset} />
        <Button label="Done" onPress={onClose} />
      </View>
    </Sheet>
  );
}
