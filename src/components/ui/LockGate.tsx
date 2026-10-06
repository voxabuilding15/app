import { useState } from 'react';
import { View } from 'react-native';

import { PIN_MAX_LENGTH, type LockMethod, type UnlockResult } from '@/core';
import { useUnlockPrompt } from '@/hooks/useLockController';
import { useTranslator } from '@/i18n';
import { spacing, useTheme } from '@/theme';

import { Button } from './Button';
import { Icon } from './Icon';
import { Input } from './Input';
import { Text } from './Text';

interface LockGateProps {
  method: Exclude<LockMethod, 'none'>;
  unlock: (pin?: string) => Promise<UnlockResult>;
  /** What is locked, already translated, e.g. "This note". */
  subject: string;
}

/** Shown instead of something locked until the person proves who they are. */
export function LockGate({ method, unlock, subject }: LockGateProps) {
  const { colors } = useTheme();
  const { t } = useTranslator();
  const [pin, setPin] = useState('');
  const { message, busy, attempt } = useUnlockPrompt(unlock);

  const submit = async () => {
    const ok = await attempt(method === 'pin' ? pin : undefined);
    if (!ok) {
      setPin('');
    }
  };

  return (
    <View style={{ alignItems: 'center', gap: spacing.lg, padding: spacing.xl }}>
      <Icon name="lock" size={48} color={colors.primary} />
      <Text variant="titleLarge" accessibilityRole="header">
        {t('{subject} is locked', { subject })}
      </Text>
      <Text tone="muted" style={{ textAlign: 'center' }}>
        {method === 'pin'
          ? t('Enter your PIN to open it.')
          : t('Use your fingerprint, face or screen lock to open it.')}
      </Text>
      {method === 'pin' ? (
        <View style={{ alignSelf: 'stretch' }}>
          <Input
            label={t('PIN')}
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={PIN_MAX_LENGTH}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            error={message ?? undefined}
          />
        </View>
      ) : message ? (
        <View accessibilityLiveRegion="polite">
          <Text tone="error">{message}</Text>
        </View>
      ) : null}
      <Button
        label={t('Unlock')}
        icon="lock-open"
        loading={busy}
        disabled={method === 'pin' && pin.length === 0}
        onPress={() => void submit()}
      />
    </View>
  );
}
