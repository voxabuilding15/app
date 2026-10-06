import { View } from 'react-native';

import { Button, Icon, PressableScale, Sheet, Text } from '@/components';
import { MIN_TOUCH_TARGET, spacing, useTheme } from '@/theme';

import type { FolderNode } from '../../domain/entities';
import { flattenFolderTree } from '../../domain/folders';

interface FolderPickerSheetProps {
  title: string;
  tree: readonly FolderNode[];
  /** Currently chosen folder id, or null. */
  selected: string | null;
  /** The unnamed choice for `null`, e.g. "No folder" or "Top level". */
  noneLabel: string;
  /** A folder (and everything in it) that cannot be chosen, e.g. when moving that folder. */
  excludeId?: string | null;
  onSelect: (folderId: string | null) => void;
  onClose: () => void;
}

interface RowProps {
  label: string;
  depth: number;
  selected: boolean;
  count?: number;
  onPress: () => void;
}

function Row({ label, depth, selected, count, onPress }: RowProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      haptic="selection"
      pressedScale={0.99}
      onPress={onPress}
    >
      <View
        style={{
          minHeight: MIN_TOUCH_TARGET,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingLeft: depth * spacing.xl,
        }}
      >
        <Icon
          name={depth === 0 && count === undefined ? 'folder-off' : 'folder'}
          color={colors.primary}
        />
        <Text variant="bodyLarge" style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </Text>
        {count !== undefined ? (
          <Text variant="labelSmall" tone="muted">
            {count}
          </Text>
        ) : null}
        {selected ? <Icon name="check" color={colors.primary} /> : null}
      </View>
    </PressableScale>
  );
}

/** Bottom sheet that shows the folder tree and picks one folder. */
export function FolderPickerSheet({
  title,
  tree,
  selected,
  noneLabel,
  excludeId = null,
  onSelect,
  onClose,
}: FolderPickerSheetProps) {
  const hidden = new Set<string>();
  const nodes = flattenFolderTree(tree).filter((node) => {
    if (node.id === excludeId) {
      hidden.add(node.id);
    }
    const parentHidden = node.parentId !== null && hidden.has(node.parentId);
    if (parentHidden) {
      hidden.add(node.id);
    }
    return !hidden.has(node.id);
  });

  const choose = (folderId: string | null) => {
    onSelect(folderId);
    onClose();
  };

  return (
    <Sheet visible title={title} onClose={onClose}>
      <View accessibilityRole="radiogroup">
        <Row
          label={noneLabel}
          depth={0}
          selected={selected === null}
          onPress={() => choose(null)}
        />
        {nodes.map((node) => (
          <Row
            key={node.id}
            label={node.name}
            depth={node.depth + 1}
            count={node.noteCount}
            selected={selected === node.id}
            onPress={() => choose(node.id)}
          />
        ))}
      </View>
      <Button label="Cancel" variant="outlined" onPress={onClose} />
    </Sheet>
  );
}
