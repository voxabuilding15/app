import { View } from 'react-native';

import { Card, Chip, Icon, IconButton, PressableScale, Text, WRAP_ROW } from '@/components';
import { spacing, useTheme } from '@/theme';

import type { Session } from '../../domain/entities';
import { KIND_LABEL, OUTCOME_LABEL, formatFocusTime, formatStartTime } from '../format';
import { useTranslator } from '@/i18n';

interface SessionRowProps {
  session: Session;
  onOpen: (session: Session) => void;
  onDelete: (session: Session) => void;
}

/** One history entry: what ran, how long, how it ended, and what it was about. */
export function SessionRow({ session, onOpen, onDelete }: SessionRowProps) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const focus = session.kind === 'focus';
  const summary = `${KIND_LABEL[session.kind]}, ${formatFocusTime(session.durationSeconds)}, ${OUTCOME_LABEL[session.outcome].toLowerCase()}`;

  const body = (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon
          name={focus ? 'self-improvement' : 'free-breakfast'}
          color={focus ? colors.primary : colors.success}
          size={20}
        />
        <Text variant="titleMedium" style={{ flex: 1 }}>
          {KIND_LABEL[session.kind]} · {formatFocusTime(session.durationSeconds)}
        </Text>
        {session.deepFocus !== null ? (
          <Text variant="labelLarge" tone="primary">
            {session.deepFocus}
          </Text>
        ) : null}
      </View>
      <Text variant="bodyMedium" tone="muted">
        {formatStartTime(session.startedAt)} · {OUTCOME_LABEL[session.outcome]}
        {session.pauses > 0
          ? ` · ${session.pauses} ${session.pauses === 1 ? 'pause' : 'pauses'}`
          : ''}
      </Text>
      {session.note !== '' ? (
        <Text variant="bodyMedium" numberOfLines={2}>
          {session.note}
        </Text>
      ) : null}
      {session.task !== null || session.habit !== null || session.tags.length > 0 ? (
        <View style={WRAP_ROW}>
          {session.task ? <Chip icon="check-circle" label={session.task.title} /> : null}
          {session.habit ? <Chip icon="local-fire-department" label={session.habit.title} /> : null}
          {session.tags.map((tag) => (
            <Chip key={tag.id} label={tag.name} dotColor={tag.color} />
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
      {focus ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('{summary}. Edit details', { summary: summary })}
          pressedScale={0.99}
          onPress={() => onOpen(session)}
          style={{ flex: 1 }}
        >
          {body}
        </PressableScale>
      ) : (
        <View accessible accessibilityLabel={summary} style={{ flex: 1 }}>
          {body}
        </View>
      )}
      <IconButton
        icon="delete-outline"
        label={t('Delete {summary}', { summary: summary })}
        onPress={() => onDelete(session)}
      />
    </Card>
  );
}
