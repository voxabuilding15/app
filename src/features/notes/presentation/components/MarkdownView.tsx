import { Linking, Text as NativeText, View } from 'react-native';

import { Checkbox, Text } from '@/components';
import { radius, spacing, useTheme } from '@/theme';

import { parseMarkdown, type Block, type Inline } from '../../domain/markdown';

const INDENT = 20;

interface MarkdownViewProps {
  source: string;
  /** Makes tasks tickable; receives the source line of the task that was pressed. */
  onToggleTask?: (line: number) => void;
}

function InlineRuns({ inlines }: { inlines: readonly Inline[] }) {
  const { colors } = useTheme();
  return (
    <>
      {inlines.map((inline, index) => {
        const decorations = [
          inline.underline || inline.type === 'link' ? 'underline' : '',
          inline.strike ? 'line-through' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <NativeText
            key={index}
            accessibilityRole={inline.type === 'link' ? 'link' : undefined}
            onPress={inline.type === 'link' ? () => void Linking.openURL(inline.url) : undefined}
            style={{
              fontWeight: inline.bold ? '700' : undefined,
              fontStyle: inline.italic ? 'italic' : undefined,
              textDecorationLine: (decorations || 'none') as 'none',
              color: inline.type === 'link' ? colors.primary : undefined,
              ...(inline.code
                ? { fontFamily: 'monospace', backgroundColor: colors.surfaceContainer }
                : null),
            }}
          >
            {inline.text}
          </NativeText>
        );
      })}
    </>
  );
}

function BlockView({
  block,
  onToggleTask,
}: {
  block: Block;
  onToggleTask?: (line: number) => void;
}) {
  const { colors } = useTheme();

  switch (block.type) {
    case 'heading':
      return (
        <Text
          accessibilityRole="header"
          variant={
            block.level === 1 ? 'headlineSmall' : block.level === 2 ? 'titleLarge' : 'titleMedium'
          }
        >
          <InlineRuns inlines={block.inlines} />
        </Text>
      );
    case 'task':
      return (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', marginLeft: block.indent * INDENT }}
        >
          <Checkbox
            checked={block.checked}
            disabled={onToggleTask === undefined}
            label={`${block.inlines.map((inline) => inline.text).join('')}, ${block.checked ? 'done' : 'not done'}`}
            onChange={() => onToggleTask?.(block.line)}
          />
          <Text
            variant="bodyLarge"
            style={[
              { flex: 1 },
              block.checked
                ? { textDecorationLine: 'line-through', color: colors.onSurfaceVariant }
                : null,
            ]}
          >
            <InlineRuns inlines={block.inlines} />
          </Text>
        </View>
      );
    case 'bullet':
    case 'ordered':
      return (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginLeft: block.indent * INDENT }}>
          <Text variant="bodyLarge" style={{ minWidth: 20 }}>
            {block.type === 'bullet' ? '•' : `${block.number}.`}
          </Text>
          <Text variant="bodyLarge" style={{ flex: 1 }}>
            <InlineRuns inlines={block.inlines} />
          </Text>
        </View>
      );
    case 'quote':
      return (
        <View
          style={{ borderLeftWidth: 3, borderLeftColor: colors.outline, paddingLeft: spacing.md }}
        >
          <Text variant="bodyLarge" tone="muted" style={{ fontStyle: 'italic' }}>
            <InlineRuns inlines={block.inlines} />
          </Text>
        </View>
      );
    case 'rule':
      return (
        <View
          accessibilityRole="none"
          style={{ height: 1, backgroundColor: colors.outlineVariant }}
        />
      );
    case 'code':
      return (
        <View
          style={{
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceContainer,
          }}
        >
          <NativeText style={{ fontFamily: 'monospace', color: colors.onSurface }}>
            {block.text}
          </NativeText>
        </View>
      );
    default:
      return (
        <Text variant="bodyLarge">
          <InlineRuns inlines={block.inlines} />
        </Text>
      );
  }
}

/** A note's Markdown drawn with real formatting; tasks can be ticked straight from here. */
export function MarkdownView({ source, onToggleTask }: MarkdownViewProps) {
  const blocks = parseMarkdown(source);
  return (
    <View style={{ gap: spacing.sm }}>
      {blocks.map((block) => (
        <BlockView key={`${block.line}-${block.type}`} block={block} onToggleTask={onToggleTask} />
      ))}
    </View>
  );
}
