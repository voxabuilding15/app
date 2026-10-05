import { useCallback, useEffect } from 'react';

import { useOnAppForeground } from '@/hooks';

import { useFinanceModule } from './module';
import { useInvalidateFinance } from './queries';

/**
 * Headless component that records recurring transactions as they fall due: when the app starts and
 * whenever it returns to the foreground, so a rule never needs the app to be open at midnight.
 */
export function FinanceBridge() {
  const { recurring } = useFinanceModule();
  const invalidate = useInvalidateFinance();

  const post = useCallback(() => {
    recurring
      .postDue()
      .then((posted) => (posted > 0 ? invalidate() : undefined))
      .catch(() => undefined);
  }, [recurring, invalidate]);

  useOnAppForeground(post);
  useEffect(post, [post]);

  return null;
}
