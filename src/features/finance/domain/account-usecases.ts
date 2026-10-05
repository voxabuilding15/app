import { createId, type Clock } from '@/core';

import type { Account, AccountBalance } from './entities';
import type { AccountRepository } from './ports';
import { hasErrors, validateAccount, type AccountDraft, type AccountErrors } from './validation';

export type SaveAccountResult = { ok: true; id: string } | { ok: false; errors: AccountErrors };

/** Raised when deleting an account that transactions or recurring rules still refer to. */
export class AccountInUseError extends Error {
  constructor() {
    super('This account is in use.');
    this.name = 'AccountInUseError';
  }
}

interface AccountUseCaseDeps {
  accounts: AccountRepository;
  clock: Clock;
}

/** Combined balance of the accounts that are not archived. */
export function totalBalanceMinor(accounts: readonly AccountBalance[]): number {
  return accounts
    .filter((account) => account.archivedAt === null)
    .reduce((sum, account) => sum + account.balanceMinor, 0);
}

export function createAccountUseCases({ accounts, clock }: AccountUseCaseDeps) {
  return {
    list(includeArchived = false): Promise<AccountBalance[]> {
      return accounts.list(includeArchived);
    },

    get(id: string): Promise<Account | null> {
      return accounts.get(id);
    },

    async save(draft: AccountDraft, id: string | null): Promise<SaveAccountResult> {
      const errors = validateAccount(draft);
      const name = draft.name.trim();
      if (!errors.name) {
        const all = await accounts.list(true);
        if (
          all.some((other) => other.id !== id && other.name.toLowerCase() === name.toLowerCase())
        ) {
          errors.name = 'This name is already in use';
        }
      }
      if (hasErrors(errors) || draft.initialBalanceMinor === null) {
        return { ok: false, errors };
      }

      const existing = id === null ? null : await accounts.get(id);
      if (id !== null && existing === null) {
        throw new Error('This account no longer exists.');
      }
      const account: Account = {
        id: existing?.id ?? createId(),
        name,
        type: draft.type,
        color: draft.color,
        initialBalanceMinor: draft.initialBalanceMinor,
        archivedAt: existing?.archivedAt ?? null,
        createdAt: existing?.createdAt ?? clock.now(),
      };
      if (existing === null) {
        await accounts.insert(account);
      } else {
        await accounts.update(account);
      }
      return { ok: true, id: account.id };
    },

    setArchived(id: string, archived: boolean): Promise<void> {
      return accounts.setArchivedAt(id, archived ? clock.now() : null);
    },

    /** Deletes an unused account and returns it so the deletion can be undone. */
    async remove(id: string): Promise<Account> {
      const account = await accounts.get(id);
      if (account === null) {
        throw new Error('This account no longer exists.');
      }
      if ((await accounts.usageCount(id)) > 0) {
        throw new AccountInUseError();
      }
      await accounts.delete(id);
      return account;
    },

    restore(account: Account): Promise<void> {
      return accounts.insert(account);
    },
  };
}

export type AccountUseCases = ReturnType<typeof createAccountUseCases>;
