import { View } from 'react-native';

import { Button, Chip, ColorSwatches, Input, Sheet, Text, WRAP_ROW } from '@/components';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import { ACCOUNT_TYPES, type AccountBalance } from '../../domain/entities';
import { NAME_MAX_LENGTH } from '../../domain/validation';
import { ACCOUNT_TYPE_LABEL } from '../format';
import { useAccountEditor } from '../view-models/useAccountsViewModel';
import { INVALID_AMOUNT } from '../view-models/useMovementForm';

interface AccountSheetProps {
  /** The account to edit, or null to create one. */
  account: AccountBalance | null;
  onClose: () => void;
}

/** Sheet to create or edit an account. Mount only while open so state starts fresh. */
export function AccountSheet({ account, onClose }: AccountSheetProps) {
  const { t } = useTranslator();
  const editor = useAccountEditor(account, onClose);
  const balanceUnreadable = editor.errors.balance === INVALID_AMOUNT;

  return (
    <Sheet
      visible
      title={account === null ? t('New account') : t('Edit account')}
      onClose={onClose}
    >
      <Input
        label={t('Name')}
        value={editor.name}
        onChangeText={editor.setName}
        error={editor.errors.name}
        maxLength={NAME_MAX_LENGTH}
        autoFocus
        returnKeyType="next"
      />
      <View style={{ gap: spacing.sm }}>
        <Text variant="labelSmall" tone="muted">
          {t('Type')}
        </Text>
        <View style={WRAP_ROW}>
          {ACCOUNT_TYPES.map((type) => (
            <Chip
              key={type}
              label={ACCOUNT_TYPE_LABEL[type]}
              selected={editor.type === type}
              onPress={() => editor.setType(type)}
            />
          ))}
        </View>
      </View>
      <Input
        label={t('Opening balance ({currency})', { currency: editor.currency })}
        value={editor.balanceText}
        onChangeText={editor.setBalanceText}
        error={editor.errors.balance}
        keyboardType="numbers-and-punctuation"
      />
      <Text variant="labelSmall" tone="muted">
        {balanceUnreadable
          ? t('Use digits and one decimal separator.')
          : t('Use a negative number for money you owe, such as a credit card balance.')}
      </Text>
      <View style={{ gap: spacing.sm }}>
        <Text variant="labelSmall" tone="muted">
          {t('Color')}
        </Text>
        <ColorSwatches value={editor.color} onChange={editor.setColor} />
      </View>
      {editor.failure ? (
        <Text tone="error" accessibilityLiveRegion="polite">
          {editor.failure}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md }}>
        <Button label={t('Cancel')} variant="outlined" onPress={onClose} />
        <Button label={t('Save')} loading={editor.saving} onPress={() => void editor.submit()} />
      </View>
    </Sheet>
  );
}
