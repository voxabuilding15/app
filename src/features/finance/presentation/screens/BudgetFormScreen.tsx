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
  useHideTabBar();
  const { colors } = useTheme();
  const load = useBudgetLoader(budgetId);
  const title = budgetId === null ? 'New budget' : 'Edit budget';

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
            accessibilityLabel="Loading budget"
          />
        </View>
      ) : (
        <Screen>
          <EmptyState
            icon="error-outline"
            title={load.phase === 'notFound' ? 'Budget not found' : "Couldn't load the budget"}
            message={
              load.phase === 'notFound'
                ? 'This budget may have been deleted.'
                : 'Your data is safe on this device. Try again.'
            }
            actionLabel={load.phase === 'failed' ? 'Try again' : undefined}
            onAction={load.phase === 'failed' ? load.retry : undefined}
          />
        </Screen>
      )}
    </>
  );
}

function BudgetFormBody({ budgetId, initial }: { budgetId: string | null; initial: BudgetDraft }) {
  const { width } = useWindowDimensions();
  const vm = useBudgetFormViewModel(budgetId, initial);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const wide = width >= WIDE_MIN_WIDTH;
  const { draft, errors } = vm;

  const details = (
    <>
      <FormSection title="Details">
        <Input
          label="Name"
          value={draft.name}
          onChangeText={vm.setName}
          error={errors.name}
          maxLength={NAME_MAX_LENGTH}
          autoFocus={!vm.isEditing}
          returnKeyType="next"
        />
        <Input
          label={`Limit (${vm.currency})`}
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
    <FormSection title="Spending it covers">
      <View style={WRAP_ROW}>
        <Chip
          label="All spending"
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
          label="New"
          accessibilityLabel="Create a category"
          onPress={() => setCreatingCategory(true)}
        />
      </View>
      <Text variant="labelSmall" tone="muted">
        Pick categories to limit the budget to them; otherwise every expense counts.
      </Text>
    </FormSection>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: vm.isEditing ? 'Edit budget' : 'New budget',
          headerRight: vm.isEditing
            ? () => <IconButton icon="delete" label="Delete budget" onPress={vm.confirmDelete} />
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
          label={vm.isEditing ? 'Save changes' : 'Create budget'}
          fullWidth
          loading={vm.saving}
          onPress={() => void vm.save()}
        />
      </Screen>

      {creatingCategory ? (
        <NameColorSheet
          title="New category"
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
