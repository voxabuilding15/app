import { View } from 'react-native';

import {
  Chip,
  CategorySection,
  FormSection,
  Input,
  SegmentedControl,
  WRAP_ROW,
  Text,
} from '@/components';
import type { Category } from '@/core';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import type { AccountBalance, TransactionType } from '../../domain/entities';
import { NOTE_MAX_LENGTH } from '../../domain/validation';
import { ACCOUNT_TYPE_LABEL, TRANSACTION_TYPE_LABEL } from '../format';

const TYPE_OPTIONS = (['expense', 'income', 'transfer'] as const).map((value) => ({
  value,
  label: TRANSACTION_TYPE_LABEL[value],
}));

interface AccountChoiceProps {
  title: string;
  accounts: readonly AccountBalance[];
  selectedId: string | null;
  error?: string;
  onSelect: (id: string) => void;
}

function AccountChoice({ title, accounts, selectedId, error, onSelect }: AccountChoiceProps) {
  return (
    <FormSection title={title} error={error}>
      <View style={WRAP_ROW}>
        {accounts.map((account) => (
          <Chip
            key={account.id}
            label={account.name}
            dotColor={account.color}
            accessibilityLabel={`${account.name}, ${ACCOUNT_TYPE_LABEL[account.type]}`}
            selected={selectedId === account.id}
            onPress={() => onSelect(account.id)}
          />
        ))}
      </View>
    </FormSection>
  );
}

interface MovementValues {
  type: TransactionType;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  note: string;
}

interface MovementErrorsView {
  amount?: string;
  account?: string;
  toAccount?: string;
  note?: string;
}

interface MovementSectionsProps {
  values: MovementValues;
  currency: string;
  amountText: string;
  /** Message for text that could not be read as an amount. */
  amountTextError?: string;
  errors: MovementErrorsView;
  accounts: readonly AccountBalance[];
  destinations: readonly AccountBalance[];
  categories: readonly Category[];
  onType: (type: TransactionType) => void;
  onAmountText: (text: string) => void;
  onAccount: (id: string) => void;
  onToAccount: (id: string) => void;
  onCategory: (id: string | null) => void;
  onCreateCategory: () => void;
  onNote: (text: string) => void;
  autoFocusAmount: boolean;
}

/** Type, amount, accounts, category and note: what a transaction and a recurring rule share. */
export function MovementSections({
  values,
  currency,
  amountText,
  amountTextError,
  errors,
  accounts,
  destinations,
  categories,
  onType,
  onAmountText,
  onAccount,
  onToAccount,
  onCategory,
  onCreateCategory,
  onNote,
  autoFocusAmount,
}: MovementSectionsProps) {
  const { t } = useTranslator();
  const transfer = values.type === 'transfer';
  return (
    <>
      <FormSection title={t('Details')}>
        <SegmentedControl options={TYPE_OPTIONS} value={values.type} onChange={onType} />
        <Input
          label={t('Amount ({currency})', { currency: currency })}
          value={amountText}
          onChangeText={onAmountText}
          error={amountTextError ?? errors.amount}
          keyboardType="decimal-pad"
          autoFocus={autoFocusAmount}
          returnKeyType="next"
        />
        <Input
          label={t('Note')}
          value={values.note}
          onChangeText={onNote}
          error={errors.note}
          maxLength={NOTE_MAX_LENGTH}
          multiline
        />
      </FormSection>
      <AccountChoice
        title={transfer ? t('From') : t('Account')}
        accounts={accounts}
        selectedId={values.accountId}
        error={errors.account}
        onSelect={onAccount}
      />
      {transfer ? (
        <AccountChoice
          title={t('To')}
          accounts={destinations}
          selectedId={values.toAccountId}
          error={errors.toAccount}
          onSelect={onToAccount}
        />
      ) : (
        <CategorySection
          categories={categories}
          selectedId={values.categoryId}
          onSelect={onCategory}
          onCreate={onCreateCategory}
        />
      )}
      {transfer && destinations.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.sm }}>
          <Text variant="labelSmall" tone="muted">
            {t('Add another account to move money between accounts.')}
          </Text>
        </View>
      ) : null}
    </>
  );
}
