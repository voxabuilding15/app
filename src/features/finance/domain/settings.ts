import { minorDigits, type KeyValueStorage } from '@/core';

import type { AccountRepository } from './ports';
import { currentTranslator } from '@/i18n/translate';

export interface CurrencyOption {
  code: string;
  name: string;
}

export const CURRENCIES: readonly CurrencyOption[] = [
  { code: 'USD', name: 'US dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
  { code: 'JPY', name: 'Japanese yen' },
  { code: 'CNY', name: 'Chinese yuan' },
  { code: 'INR', name: 'Indian rupee' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'CHF', name: 'Swiss franc' },
  { code: 'SEK', name: 'Swedish krona' },
  { code: 'NOK', name: 'Norwegian krone' },
  { code: 'DKK', name: 'Danish krone' },
  { code: 'PLN', name: 'Polish zloty' },
  { code: 'TRY', name: 'Turkish lira' },
  { code: 'MXN', name: 'Mexican peso' },
  { code: 'BRL', name: 'Brazilian real' },
  { code: 'ZAR', name: 'South African rand' },
  { code: 'NGN', name: 'Nigerian naira' },
  { code: 'EGP', name: 'Egyptian pound' },
  { code: 'MAD', name: 'Moroccan dirham' },
  { code: 'AED', name: 'UAE dirham' },
  { code: 'SAR', name: 'Saudi riyal' },
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'KRW', name: 'South Korean won' },
];

const DEFAULT_CURRENCY = 'USD';
const CURRENCY_KEY = 'finance.currency';

export type SetCurrencyResult = { ok: true } | { ok: false; error: string };

interface SettingsDeps {
  storage: KeyValueStorage;
  accounts: AccountRepository;
}

export function createSettingsUseCases({ storage, accounts }: SettingsDeps) {
  const { t } = currentTranslator();
  const isKnown = (code: string) => CURRENCIES.some((option) => option.code === code);

  function currency(): string {
    const stored = storage.getString(CURRENCY_KEY);
    return stored !== undefined && isKnown(stored) ? stored : DEFAULT_CURRENCY;
  }

  return {
    currency,

    /**
     * Amounts are stored in minor units, so once there is data the currency can only change to
     * one with the same number of decimals (the amounts are relabelled, not converted).
     */
    async setCurrency(code: string): Promise<SetCurrencyResult> {
      if (!isKnown(code)) {
        return { ok: false, error: t('This currency is not supported.') };
      }
      const current = currency();
      if (code === current) {
        return { ok: true };
      }
      if (minorDigits(code) !== minorDigits(current) && (await accounts.list(true)).length > 0) {
        return {
          ok: false,
          error: t(
            '{current} and {code} use a different number of decimals, so existing amounts would change. Delete your accounts first to switch.',
            { current: current, code: code },
          ),
        };
      }
      storage.setString(CURRENCY_KEY, code);
      return { ok: true };
    },
  };
}

export type SettingsUseCases = ReturnType<typeof createSettingsUseCases>;
