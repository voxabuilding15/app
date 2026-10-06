import { View } from 'react-native';

import { StatTile } from '@/components';
import { formatMoney } from '@/core';
import { spacing, useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import type { FlowTotals } from '../../domain/entities';

interface SummaryTilesProps {
  balanceMinor: number;
  flow: FlowTotals | undefined;
  currency: string;
}

/** Total balance and what came in and went out so far this month. */
export function SummaryTiles({ balanceMinor, flow, currency }: SummaryTilesProps) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      <StatTile
        icon="account-balance-wallet"
        label={t('Balance')}
        value={formatMoney(balanceMinor, currency)}
        caption={t('All active accounts')}
      />
      <StatTile
        icon="arrow-downward"
        accent={colors.success}
        label={t('Income')}
        value={formatMoney(flow?.incomeMinor ?? 0, currency)}
        caption={t('This month')}
      />
      <StatTile
        icon="arrow-upward"
        accent={colors.error}
        label={t('Spent')}
        value={formatMoney(flow?.expenseMinor ?? 0, currency)}
        caption={t('This month')}
      />
    </View>
  );
}
