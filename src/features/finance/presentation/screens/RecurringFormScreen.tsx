import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View, useWindowDimensions } from 'react-native';

import {
  Button,
  EmptyState,
  IconButton,
  NameColorSheet,
  RepeatSection,
  Screen,
  Text,
} from '@/components';
import { useHideTabBar } from '@/hooks';
import { ACCENT_COLORS, spacing, useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import type { RecurringDraft } from '../../domain/validation';
import { MovementSections } from '../components/MovementSections';
import { ScheduleSection } from '../components/ScheduleSection';
import { useAccounts } from '../queries';
import {
  useRecurringFormViewModel,
  useRecurringLoader,
  type NewRecurringDefaults,
} from '../view-models/useRecurringFormViewModel';

const WIDE_MIN_WIDTH = 900;
const WIDE_MAX_WIDTH = 1100;
const REPEAT_PRESETS = ['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const;
const REPEAT_UNITS = ['day', 'week', 'month', 'year'] as const;

interface RecurringFormScreenProps {
  /** Null creates a new recurring transaction. */
  recurringId: string | null;
  defaults: NewRecurringDefaults;
}

export function RecurringFormScreen({ recurringId, defaults }: RecurringFormScreenProps) {
  const { t } = useTranslator();
  useHideTabBar();
  const { colors } = useTheme();
  const load = useRecurringLoader(recurringId, defaults);
  const title =
    recurringId === null ? t('New recurring transaction') : t('Edit recurring transaction');

  if (load.phase === 'ready') {
    return <RecurringFormBody recurringId={recurringId} initial={load.initial} />;
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
            accessibilityLabel={t('Loading')}
          />
        </View>
      ) : (
        <Screen>
          <EmptyState
            icon="error-outline"
            title={load.phase === 'notFound' ? t('Not found') : t("Couldn't load this")}
            message={
              load.phase === 'notFound'
                ? t('This recurring transaction may have been deleted.')
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

interface RecurringFormBodyProps {
  recurringId: string | null;
  initial: RecurringDraft;
}

function RecurringFormBody({ recurringId, initial }: RecurringFormBodyProps) {
  const { t } = useTranslator();
  const { width } = useWindowDimensions();
  const vm = useRecurringFormViewModel(recurringId, initial);
  const activeAccounts = useAccounts(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const wide = width >= WIDE_MIN_WIDTH;
  const { draft, errors } = vm;

  const options = (
    <Stack.Screen
      options={{
        title: vm.isEditing ? t('Edit recurring transaction') : t('New recurring transaction'),
        headerRight: vm.isEditing
          ? () => (
              <IconButton
                icon="delete"
                label={t('Delete recurring transaction')}
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
            message={t(
              'Recurring transactions belong to an account, such as Cash or a bank account.',
            )}
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
  const schedule = (
    <>
      <RepeatSection
        rule={draft.rule}
        presets={REPEAT_PRESETS}
        units={REPEAT_UNITS}
        error={errors.repeat}
        onPreset={vm.setRepeatPreset}
        onChange={vm.changeRepeat}
      />
      <ScheduleSection
        startDate={draft.startDate}
        endDate={draft.endDate}
        error={errors.dates}
        backfills={vm.backfills && !vm.isEditing}
        onPickStart={() => void vm.pickStart()}
        onPickEnd={() => void vm.pickEnd()}
        onEnds={vm.setEnds}
      />
    </>
  );

  return (
    <>
      {options}
      <Screen maxWidth={wide ? WIDE_MAX_WIDTH : undefined}>
        {wide ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg }}>
            <View style={{ flex: 1, gap: spacing.lg }}>{movement}</View>
            <View style={{ flex: 1, gap: spacing.lg }}>{schedule}</View>
          </View>
        ) : (
          <>
            {movement}
            {schedule}
          </>
        )}
        {vm.saveError ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {vm.saveError}
          </Text>
        ) : null}
        <Button
          label={vm.isEditing ? t('Save changes') : t('Add recurring transaction')}
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
