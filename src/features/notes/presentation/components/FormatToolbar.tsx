import { ScrollView } from 'react-native';

import { IconButton, type IconName } from '@/components';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import type { BlockFormat, InlineFormat } from '../../domain/formatting';
import { msg } from '@/i18n/msg';

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
  { format: 'bold', icon: 'format-bold', label: msg('Bold') },
  { format: 'italic', icon: 'format-italic', label: msg('Italic') },
  { format: 'underline', icon: 'format-underlined', label: msg('Underline') },
  { format: 'strike', icon: 'format-strikethrough', label: msg('Strikethrough') },
  { format: 'code', icon: 'code', label: msg('Code') },
];

const BLOCK_BUTTONS: readonly BlockButton[] = [
  { format: 'h1', icon: 'looks-one', label: msg('Heading 1') },
  { format: 'h2', icon: 'looks-two', label: msg('Heading 2') },
  { format: 'h3', icon: 'looks-3', label: msg('Heading 3') },
  { format: 'bullet', icon: 'format-list-bulleted', label: msg('Bulleted list') },
  { format: 'ordered', icon: 'format-list-numbered', label: msg('Numbered list') },
  { format: 'task', icon: 'checklist', label: msg('Checklist') },
  { format: 'quote', icon: 'format-quote', label: msg('Quote') },
];

interface FormatToolbarProps {
  onInline: (format: InlineFormat) => void;
  onBlock: (format: BlockFormat) => void;
}

/** Formatting buttons that edit the Markdown around the cursor or selection. */
export function FormatToolbar({ onInline, onBlock }: FormatToolbarProps) {
  const { t } = useTranslator();
  return (
    <ScrollView
      horizontal
      accessibilityRole="toolbar"
      accessibilityLabel={t('Formatting')}
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
