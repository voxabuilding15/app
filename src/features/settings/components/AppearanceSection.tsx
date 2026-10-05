import { Card, SectionHeader, SegmentedControl, Text } from '@/components';
import { APP_NAME } from '@/constants/app';
import { spacing, useTheme, type ThemePreference } from '@/theme';

const THEME_OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function AppearanceSection() {
  const { preference, setPreference } = useTheme();

  return (
    <>
      <SectionHeader title="Appearance" />
      <Card style={{ gap: spacing.md }}>
        <Text tone="muted">Choose how {APP_NAME} looks.</Text>
        <SegmentedControl options={THEME_OPTIONS} value={preference} onChange={setPreference} />
      </Card>
    </>
  );
}
