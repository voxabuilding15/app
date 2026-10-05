import type { TransactionType } from './entities';
import type { AccountRepository } from './ports';

interface Movement {
  type: TransactionType;
  accountId: string | null;
  toAccountId: string | null;
}

interface CurrentAccounts {
  accountId: string | null;
  toAccountId: string | null;
}

export interface AccountProblems {
  account?: string;
  toAccount?: string;
}

/**
 * Checks that the accounts a transaction (or rule) uses exist and are not archived. Accounts the
 * item already used are exempt, so an archived account's history stays editable.
 */
export async function checkAccounts(
  accounts: AccountRepository,
  movement: Movement,
  current: CurrentAccounts | null,
): Promise<AccountProblems> {
  const problem = async (accountId: string | null, already: string | null) => {
    if (accountId === null || accountId === already) {
      return undefined;
    }
    const account = await accounts.get(accountId);
    if (account === null) {
      return 'This account no longer exists';
    }
    return account.archivedAt === null ? undefined : 'This account is archived';
  };

  const problems: AccountProblems = {};
  const source = await problem(movement.accountId, current?.accountId ?? null);
  if (source) {
    problems.account = source;
  }
  if (movement.type === 'transfer') {
    const destination = await problem(movement.toAccountId, current?.toAccountId ?? null);
    if (destination) {
      problems.toAccount = destination;
    }
  }
  return problems;
}
