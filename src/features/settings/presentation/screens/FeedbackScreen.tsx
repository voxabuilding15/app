import { Stack } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  Input,
  Screen,
  Snackbar,
  SwitchRow,
  Text,
  WRAP_ROW,
} from '@/components';
import { APP_VERSION } from '@/constants/app';
import { useNotice } from '@/hooks';
import { useTranslator } from '@/i18n';
import { spacing } from '@/theme';

import {
  FEEDBACK_MAX_LENGTH,
  composeFeedback,
  validateFeedback,
  type FeedbackKind,
} from '../../domain/feedback';
import { useUsage } from '../queries';

/** Write feedback and hand it to any app that can send it, such as email. */
export function FeedbackScreen() {
  const { t, locale } = useTranslator();
  const { data } = useUsage();
  const { notice, show, dismiss } = useNotice();
  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const kinds: { value: FeedbackKind; label: string }[] = [
    { value: 'idea', label: t('Idea') },
    { value: 'bug', label: t('Problem') },
    { value: 'other', label: t('Other') },
  ];

  const send = async () => {
    const problem = validateFeedback(message);
    if (problem !== null) {
      setError(
        problem === 'empty'
          ? t('Write a few words first')
          : t('Use {count} characters or fewer', { count: FEEDBACK_MAX_LENGTH }),
      );
      return;
    }
    setError(null);
    const { subject, body } = composeFeedback(
      kind,
      message,
      {
        appVersion: APP_VERSION,
        schemaVersion: data?.schemaVersion ?? 0,
        platform: `${Platform.OS} ${String(Platform.Version)}`,
        language: locale,
      },
      details,
    );
    try {
      const result = await Share.share({ title: subject, message: `${subject}\n\n${body}` });
      if (result.action === Share.sharedAction) {
        setMessage('');
        show({ message: t('Thank you for your feedback') });
      }
    } catch {
      show({ message: t("Couldn't open the share sheet") });
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Feedback') }} />
      <Screen>
        <Card style={{ gap: spacing.md }}>
          <Text tone="muted">
            {t(
              'Tell us what works, what does not and what you would like. Your message is shared through the app you choose, so nothing is sent without you.',
            )}
          </Text>
          <View style={WRAP_ROW}>
            {kinds.map((option) => (
              <Chip
                key={option.value}
                label={t(option.label)}
                selected={kind === option.value}
                onPress={() => setKind(option.value)}
              />
            ))}
          </View>
          <Input
            label={t('Your message')}
            value={message}
            onChangeText={(text) => {
              setMessage(text);
              setError(null);
            }}
            multiline
            maxLength={FEEDBACK_MAX_LENGTH + 100}
            error={error ?? undefined}
            style={{ minHeight: 140 }}
          />
          <SwitchRow
            title={t('Include technical details')}
            subtitle={t(
              'App version, database version, phone system and language. Never your data.',
            )}
            value={details}
            onChange={setDetails}
          />
          <Button label={t('Share feedback')} icon="send" onPress={() => void send()} />
        </Card>
      </Screen>
      {notice ? <Snackbar message={notice.message} onDismiss={dismiss} /> : null}
    </>
  );
}
