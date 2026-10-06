import { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, Sheet, Text, WRAP_ROW } from '@/components';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import { CURRENCIES } from '../../domain/settings';
import { useFinanceModule } from '../module';
import { useCurrency, useInvalidateFinance } from '../queries';

interface CurrencySheetProps {
  onClose: () => void;
}

/** Sheet to choose the currency amounts are shown in. Mount only while open. */
export function CurrencySheet({ onClose }: CurrencySheetProps) {
  const { t } = useTranslator();
  const { settings } = useFinanceModule();
  const invalidate = useInvalidateFinance();
  const current = useCurrency();
  const [error, setError] = useState<string | null>(null);

  const choose = async (code: string) => {
    const result = await settings.setCurrency(code);
    if (result.ok) {
      setError(null);
      await invalidate();
    } else {
      setError(result.error);
    }
  };

  return (
    <Sheet visible title={t('Currency')} onClose={onClose}>
      <Text variant="bodyMedium" tone="muted">
        {t('Amounts are only relabelled when you switch, not converted.')}
      </Text>
      <View style={WRAP_ROW}>
        {CURRENCIES.map((option) => (
          <Chip
            key={option.code}
            label={option.code}
            accessibilityLabel={`${option.name} (${option.code})`}
            selected={option.code === current}
            onPress={() => void choose(option.code)}
          />
        ))}
      </View>
      {error ? (
        <View accessibilityLiveRegion="polite">
          <Text tone="error">{error}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md }}>
        <Button label={t('Done')} onPress={onClose} />
      </View>
    </Sheet>
  );
}
