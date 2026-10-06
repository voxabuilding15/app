import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View, useWindowDimensions } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  FormSection,
  IconButton,
  Input,
  NameColorSheet,
  Screen,
  Text,
  WRAP_ROW,
} from '@/components';
import { useHideTabBar } from '@/hooks';
import { ACCENT_COLORS, spacing, useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import { NAME_MAX_LENGTH, type BudgetDraft } from '../../domain/validation';
import { BudgetPeriodSection } from '../components/BudgetPeriodSection';
import { useBudgetFormViewModel, useBudgetLoader } from '../view-models/useBudgetFormViewModel';

const WIDE_MIN_WIDTH = 900;
const WIDE_MAX_WIDTH = 1100;

interface BudgetFormScreenProps {
  /** Null creates a new budget. */
  budgetId: string | null;
}

export function BudgetFormScreen({ budgetId }: BudgetFormScreenProps) {
  const { t } = useTranslator();
  useHideTabBar();
  const { colors } = useTheme();
  const load = useBudgetLoader(budgetId);
  const title = budgetId === null ? t('New budget') : t('Edit budget');

  if (load.phase === 'ready') {
    return <BudgetFormBody budgetId={budgetId} initial={load.initial} />;
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
            accessibilityLabel={t('Loading budget')}
          />
        </View>
      ) : (
        <Screen>
          <EmptyState
            icon="error-outline"
            title={
              load.phase === 'notFound' ? t('Budget not found') : t("Couldn't load the budget")
            }
            message={
              load.phase === 'notFound'
                ? t('This budget may have been deleted.')
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

function BudgetFormBody({ budgetId, initial }: { budgetId: string | null; initial: BudgetDraft }) {
  const { t } = useTranslator();
  const { width } = useWindowDimensions();
  const vm = useBudgetFormViewModel(budgetId, initial);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const wide = width >= WIDE_MIN_WIDTH;
  const { draft, errors } = vm;

  const details = (
    <>
      <FormSection title={t('Details')}>
        <Input
          label={t('Name')}
          value={draft.name}
          onChangeText={vm.setName}
          error={errors.name}
          maxLength={NAME_MAX_LENGTH}
          autoFocus={!vm.isEditing}
          returnKeyType="next"
        />
        <Input
          label={t('Limit ({currency})', { currency: vm.currency })}
          value={vm.amountText}
          onChangeText={vm.setAmountText}
          error={vm.amountTextError ?? errors.amount}
          keyboardType="decimal-pad"
        />
      </FormSection>
      <BudgetPeriodSection
        period={draft.period}
        startDate={draft.startDate}
        endDate={draft.endDate}
        error={errors.dates}
        onPeriod={vm.setPeriod}
        onPickStart={() => void vm.pickDay('start')}
        onPickEnd={() => void vm.pickDay('end')}
      />
    </>
  );

  const categories = (
    <FormSection title={t('Spending it covers')}>
      <View style={WRAP_ROW}>
        <Chip
          label={t('All spending')}
          selected={draft.categoryIds.length === 0}
          onPress={vm.clearCategories}
        />
        {vm.categories.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            dotColor={category.color}
            selected={draft.categoryIds.includes(category.id)}
            onPress={() => vm.toggleCategory(category.id)}
          />
        ))}
        <Chip
          icon="add"
          label={t('New')}
          accessibilityLabel={t('Create a category')}
          onPress={() => setCreatingCategory(true)}
        />
      </View>
      <Text variant="labelSmall" tone="muted">
        {t('Pick categories to limit the budget to them; otherwise every expense counts.')}
      </Text>
    </FormSection>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: vm.isEditing ? t('Edit budget') : t('New budget'),
          headerRight: vm.isEditing
            ? () => (
                <IconButton icon="delete" label={t('Delete budget')} onPress={vm.confirmDelete} />
              )
            : undefined,
        }}
      />
      <Screen maxWidth={wide ? WIDE_MAX_WIDTH : undefined}>
        {wide ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg }}>
            <View style={{ flex: 1, gap: spacing.lg }}>{details}</View>
            <View style={{ flex: 1, gap: spacing.lg }}>{categories}</View>
          </View>
        ) : (
          <>
            {details}
            {categories}
          </>
        )}
        {vm.saveError ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {vm.saveError}
          </Text>
        ) : null}
        <Button
          label={vm.isEditing ? t('Save changes') : t('Create budget')}
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
