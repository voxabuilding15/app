import { ScrollView } from 'react-native';

import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import { Chip } from './Chip';

interface TabOption<T extends string> {
  value: T;
  label: string;
}

interface ChipTabsProps<T extends string> {
  tabs: readonly TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Spoken name for the group, e.g. "Finance sections". */
  label: string;
}

/** A scrollable row of chips for switching between sections that do not fit a segmented control. */
export function ChipTabs<T extends string>({ tabs, value, onChange, label }: ChipTabsProps<T>) {
  const { t } = useTranslator();
  return (
    <ScrollView
      horizontal
      accessibilityRole="tablist"
      accessibilityLabel={label}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xs,
      }}
    >
      {tabs.map((tab) => (
        <Chip
          key={tab.value}
          label={t(tab.label)}
          selected={tab.value === value}
          onPress={() => onChange(tab.value)}
        />
      ))}
    </ScrollView>
  );
}
