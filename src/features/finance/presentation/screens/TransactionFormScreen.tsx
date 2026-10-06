import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View, useWindowDimensions } from 'react-native';

import {
  Button,
  DateTimeSection,
  EmptyState,
  IconButton,
  NameColorSheet,
  Screen,
  Text,
} from '@/components';
import { useHideTabBar, useNow } from '@/hooks';
import { ACCENT_COLORS, spacing, useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import type { TransactionDraft } from '../../domain/validation';
import { MovementSections } from '../components/MovementSections';
import {
  useTransactionFormViewModel,
  useTransactionLoader,
  type NewTransactionDefaults,
} from '../view-models/useTransactionFormViewModel';
import { formatDate, formatTime } from '../format';
import { useAccounts } from '../queries';

const WIDE_MIN_WIDTH = 900;
const WIDE_MAX_WIDTH = 1100;

interface TransactionFormScreenProps {
  /** Null creates a new transaction. */
  transactionId: string | null;
  defaults: NewTransactionDefaults;
}

export function TransactionFormScreen({ transactionId, defaults }: TransactionFormScreenProps) {
  const { t } = useTranslator();
  useHideTabBar();
  const { colors } = useTheme();
  const load = useTransactionLoader(transactionId, defaults);
  const title = transactionId === null ? t('New transaction') : t('Edit transaction');

  if (load.phase === 'ready') {
    return <TransactionFormBody transactionId={transactionId} initial={load.initial} />;
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      {load.phase === 'loading' ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator
            size="large"
            color={colors.primary}
            accessibilityLabel={t('Loading transaction')}
          />
        </View>
      ) : (
        <Screen>
          <EmptyState
            icon="error-outline"
            title={
              load.phase === 'notFound'
                ? t('Transaction not found')
                : t("Couldn't load the transaction")
            }
            message={
              load.phase === 'notFound'
                ? t('This transaction may have been deleted.')
                : t('Your data is safe on this device. Try again.')
            }
            actionLabel={load.phase === 'failed' ? t('Try again') : undefined}
            onAction={load.phase === 'failed' ? load.retry : undefined}
          />
        </Screen>
      )}
    </>
  );
}

interface TransactionFormBodyProps {
  transactionId: string | null;
  initial: TransactionDraft;
}

function TransactionFormBody({ transactionId, initial }: TransactionFormBodyProps) {
  const { t } = useTranslator();
  const { width } = useWindowDimensions();
  const now = useNow();
  const vm = useTransactionFormViewModel(transactionId, initial);
  const activeAccounts = useAccounts(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const wide = width >= WIDE_MIN_WIDTH;
  const { draft, errors } = vm;

  const options = (
    <Stack.Screen
      options={{
        title: vm.isEditing ? t('Edit transaction') : t('New transaction'),
        headerRight: vm.isEditing
          ? () => (
              <IconButton
                icon="delete"
                label={t('Delete transaction')}
                onPress={vm.confirmDelete}
              />
            )
          : undefined,
      }}
    />
  );

  if (!vm.isEditing && activeAccounts.data?.length === 0) {
    return (
      <>
        {options}
        <Screen>
          <EmptyState
            icon="account-balance-wallet"
            title={t('Add an account first')}
            message={t('Transactions belong to an account, such as Cash or a bank account.')}
          />
        </Screen>
      </>
    );
  }

  const movement = (
    <MovementSections
      values={draft}
      currency={vm.currency}
      amountText={vm.amountText}
      amountTextError={vm.amountTextError}
      errors={errors}
      accounts={vm.accounts}
      destinations={vm.destinations}
      categories={vm.categories}
      onType={vm.setType}
      onAmountText={vm.setAmountText}
      onAccount={vm.setAccount}
      onToAccount={vm.setToAccount}
      onCategory={vm.setCategory}
      onCreateCategory={() => setCreatingCategory(true)}
      onNote={vm.setNote}
      autoFocusAmount={!vm.isEditing}
    />
  );
  const when = (
    <DateTimeSection
      title={t('Date and time')}
      dayLabel={formatDate(draft.occurredAt, now)}
      timeLabel={formatTime(draft.occurredAt)}
      error={errors.date}
      onPickDay={() => void vm.pickDay()}
      onPickTime={() => void vm.pickClock()}
    />
  );

  return (
    <>
      {options}
      <Screen maxWidth={wide ? WIDE_MAX_WIDTH : undefined}>
        {wide ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg }}>
            <View style={{ flex: 1, gap: spacing.lg }}>{movement}</View>
            <View style={{ flex: 1, gap: spacing.lg }}>{when}</View>
          </View>
        ) : (
          <>
            {movement}
            {when}
          </>
        )}
        {vm.saveError ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {vm.saveError}
          </Text>
        ) : null}
        <Button
          label={vm.isEditing ? t('Save changes') : t('Add transaction')}
          fullWidth
          loading={vm.saving}
          onPress={() => void vm.save()}
        />
      </Screen>

      {creatingCategory ? (
        <NameColorSheet
          title={t('New category')}
          initialName=""
          initialColor={ACCENT_COLORS[0]}
          onSave={async (name, color) => {
            const error = await vm.createCategory(name, color);
            if (error === null) {
              setCreatingCategory(false);
            }
            return error;
          }}
          onClose={() => setCreatingCategory(false)}
        />
      ) : null}
    </>
  );
}
