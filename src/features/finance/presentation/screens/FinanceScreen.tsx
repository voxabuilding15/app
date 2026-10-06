import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ChipTabs, IconButton, ScreenToolbar } from '@/components';
import { useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import { CurrencySheet } from '../components/CurrencySheet';

import { AccountsSection } from './AccountsSection';
import { ActivitySection } from './ActivitySection';
import { BudgetsSection } from './BudgetsSection';
import { RecurringSection } from './RecurringSection';
import { StatsSection } from './StatsSection';
import { msg } from '@/i18n/msg';

type Section = 'activity' | 'accounts' | 'budgets' | 'recurring' | 'stats';

const SECTIONS = [
  { value: 'activity', label: msg('Activity') },
  { value: 'accounts', label: msg('Accounts') },
  { value: 'budgets', label: msg('Budgets') },
  { value: 'recurring', label: msg('Recurring') },
  { value: 'stats', label: msg('Stats') },
] as const satisfies readonly { value: Section; label: string }[];

/** Money tab: transactions, accounts, budgets, recurring transactions and statistics. */
export function FinanceScreen() {
  const { t } = useTranslator();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const [section, setSection] = useState<Section>('activity');
  // Changing `nonce` remounts the activity tab so it starts on the chosen account.
  const [focus, setFocus] = useState<{ accountId: string | null; nonce: number }>({
    accountId: null,
    nonce: 0,
  });
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const showAccounts = useCallback(() => setSection('accounts'), []);
  const showTransactions = useCallback((accountId: string) => {
    setFocus((current) => ({ accountId, nonce: current.nonce + 1 }));
    setSection('activity');
  }, []);
  const changeSection = useCallback((next: Section) => {
    setSection(next);
    if (next === 'activity') {
      setFocus((current) =>
        current.accountId === null ? current : { accountId: null, nonce: current.nonce + 1 },
      );
    }
  }, []);

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
      <ScreenToolbar title={t('Finance')}>
        <IconButton
          icon="payments"
          label={t('Change currency')}
          onPress={() => setCurrencyOpen(true)}
        />
        <IconButton
          icon="label"
          label={t('Manage categories')}
          onPress={() => router.push('/finance/categories')}
        />
      </ScreenToolbar>
      <ChipTabs
        label={t('Finance sections')}
        tabs={SECTIONS}
        value={section}
        onChange={changeSection}
      />

      <View style={{ flex: 1 }}>
        {section === 'activity' ? (
          <ActivitySection
            key={focus.nonce}
            initialAccountId={focus.accountId}
            onShowAccounts={showAccounts}
          />
        ) : null}
        {section === 'accounts' ? <AccountsSection onShowTransactions={showTransactions} /> : null}
        {section === 'budgets' ? <BudgetsSection /> : null}
        {section === 'recurring' ? <RecurringSection /> : null}
        {section === 'stats' ? <StatsSection /> : null}
      </View>

      {currencyOpen ? <CurrencySheet onClose={() => setCurrencyOpen(false)} /> : null}
    </View>
  );
}
