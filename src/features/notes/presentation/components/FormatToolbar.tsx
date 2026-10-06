import { ScrollView } from 'react-native';

import { IconButton, type IconName } from '@/components';
import { spacing } from '@/theme';

import type { BlockFormat, InlineFormat } from '../../domain/formatting';

interface InlineButton {
  format: InlineFormat;
  icon: IconName;
  label: string;
}
interface BlockButton {
  format: BlockFormat;
  icon: IconName;
  label: string;
}

const INLINE_BUTTONS: readonly InlineButton[] = [
  { format: 'bold', icon: 'format-bold', label: 'Bold' },
  { format: 'italic', icon: 'format-italic', label: 'Italic' },
  { format: 'underline', icon: 'format-underlined', label: 'Underline' },
  { format: 'strike', icon: 'format-strikethrough', label: 'Strikethrough' },
  { format: 'code', icon: 'code', label: 'Code' },
];

const BLOCK_BUTTONS: readonly BlockButton[] = [
  { format: 'h1', icon: 'looks-one', label: 'Heading 1' },
  { format: 'h2', icon: 'looks-two', label: 'Heading 2' },
  { format: 'h3', icon: 'looks-3', label: 'Heading 3' },
  { format: 'bullet', icon: 'format-list-bulleted', label: 'Bulleted list' },
  { format: 'ordered', icon: 'format-list-numbered', label: 'Numbered list' },
  { format: 'task', icon: 'checklist', label: 'Checklist' },
  { format: 'quote', icon: 'format-quote', label: 'Quote' },
];

interface FormatToolbarProps {
  onInline: (format: InlineFormat) => void;
  onBlock: (format: BlockFormat) => void;
}

/** Formatting buttons that edit the Markdown around the cursor or selection. */
export function FormatToolbar({ onInline, onBlock }: FormatToolbarProps) {
  return (
    <ScrollView
      horizontal
      accessibilityRole="toolbar"
      accessibilityLabel="Formatting"
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      contentContainerStyle={{ gap: spacing.xs, alignItems: 'center' }}
    >
      {INLINE_BUTTONS.map((button) => (
        <IconButton
          key={button.format}
          icon={button.icon}
          label={button.label}
          onPress={() => onInline(button.format)}
        />
      ))}
      {BLOCK_BUTTONS.map((button) => (
        <IconButton
          key={button.format}
          icon={button.icon}
          label={button.label}
          onPress={() => onBlock(button.format)}
        />
      ))}
    </ScrollView>
  );
}
