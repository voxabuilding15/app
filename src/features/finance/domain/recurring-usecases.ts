import {
  addDaysToKey,
  atHour,
  createId,
  dateKeyToNoon,
  hasWeekday,
  occurrenceKeys,
  toDateKey,
  weekdayOfKey,
  type Clock,
  type DateKey,
  type RecurrenceRule,
} from '@/core';

import { checkAccounts } from './account-checks';
import type { RecurringRecord, RecurringTransaction, TransactionRecord } from './entities';
import type { AccountRepository, RecurringRepository } from './ports';
import {
  hasErrors,
  validateRecurring,
  type RecurringDraft,
  type RecurringErrors,
} from './validation';
import { currentTranslator } from '@/i18n/translate';

export type SaveRecurringResult =
  { ok: true; id: string; posted: number } | { ok: false; errors: RecurringErrors };

/** Recurring transactions are stamped at this local hour on the day they fall due. */
const POST_HOUR = 9;
/** Limits how much a single run catches up on after a long absence. */
const MAX_POSTS_PER_RUN = 366;
/** Hard stop when searching a schedule, far beyond any sensible rule. */
const MAX_SCAN = 50_000;

interface RecurringUseCaseDeps {
  recurring: RecurringRepository;
  accounts: AccountRepository;
  clock: Clock;
}

/** The first day on or after `start` that a rule with selected weekdays actually falls on. */
function alignStart(rule: RecurrenceRule, start: DateKey): DateKey {
  if (rule.unit !== 'week' || rule.weekdays === 0) {
    return start;
  }
  let day = start;
  for (let step = 0; step < 7 && !hasWeekday(rule.weekdays, weekdayOfKey(day)); step += 1) {
    day = addDaysToKey(day, 1);
  }
  return day;
}

/** First occurrence on or after `from`, or null when the series ends before then. */
function firstOccurrenceFrom(
  rule: RecurrenceRule,
  start: DateKey,
  end: DateKey | null,
  from: DateKey,
): DateKey | null {
  let scanned = 0;
  for (const key of occurrenceKeys(rule, start)) {
    if ((end !== null && key > end) || (scanned += 1) > MAX_SCAN) {
      return null;
    }
    if (key >= from) {
      return key;
    }
  }
  return null;
}

function sameRule(a: RecurrenceRule, b: RecurrenceRule): boolean {
  return a.unit === b.unit && a.interval === b.interval && a.weekdays === b.weekdays;
}

export function createRecurringUseCases({ recurring, accounts, clock }: RecurringUseCaseDeps) {
  const { t } = currentTranslator();
  const todayKey = () => toDateKey(clock.now());

  /** Posts every occurrence that has come due since each rule last ran. Returns how many. */
  async function postDue(): Promise<number> {
    const now = clock.now();
    const today = toDateKey(now);
    let posted = 0;

    for (const rule of await recurring.listDue(today)) {
      const transactions: TransactionRecord[] = [];
      let next: DateKey | null = null;
      let scanned = 0;

      for (const key of occurrenceKeys(rule.rule, rule.startDate)) {
        if ((rule.endDate !== null && key > rule.endDate) || (scanned += 1) > MAX_SCAN) {
          break;
        }
        if (rule.nextDate !== null && key < rule.nextDate) {
          continue;
        }
        if (key > today || transactions.length >= MAX_POSTS_PER_RUN) {
          next = key;
          break;
        }
        transactions.push({
          id: createId(),
          type: rule.type,
          amountMinor: rule.amountMinor,
          accountId: rule.accountId,
          toAccountId: rule.toAccountId,
          categoryId: rule.categoryId,
          note: rule.note,
          occurredAt: atHour(dateKeyToNoon(key), POST_HOUR),
          recurringId: rule.id,
          occurrenceDate: key,
          createdAt: now,
          updatedAt: now,
        });
      }
      await recurring.postOccurrences(rule.id, transactions, next, now);
      posted += transactions.length;
    }
    return posted;
  }

  return {
    list(): Promise<RecurringTransaction[]> {
      return recurring.list();
    },

    get(id: string): Promise<RecurringRecord | null> {
      return recurring.get(id);
    },

    postDue,

    async save(draft: RecurringDraft, id: string | null): Promise<SaveRecurringResult> {
      const errors = validateRecurring(draft);
      const existing = id === null ? null : await recurring.get(id);
      if (id !== null && existing === null) {
        throw new Error(t('This recurring transaction no longer exists.'));
      }
      Object.assign(errors, await checkAccounts(accounts, draft, existing));
      if (hasErrors(errors) || draft.amountMinor === null || draft.accountId === null) {
        return { ok: false, errors };
      }

      const now = clock.now();
      const transfer = draft.type === 'transfer';
      const startDate = alignStart(draft.rule, draft.startDate);
      const endDate = draft.endDate;
      const today = todayKey();
      const from = startDate > today ? startDate : today;

      let nextDate: DateKey | null;
      if (existing === null) {
        // A start date in the past back-posts the occurrences since then.
        nextDate = startDate;
      } else if (
        existing.nextDate === null ||
        existing.startDate !== startDate ||
        !sameRule(existing.rule, draft.rule)
      ) {
        nextDate = firstOccurrenceFrom(draft.rule, startDate, endDate, from);
      } else {
        nextDate = endDate !== null && existing.nextDate > endDate ? null : existing.nextDate;
      }
      if (endDate !== null && nextDate !== null && nextDate > endDate) {
        nextDate = null;
      }

      const record: RecurringRecord = {
        id: existing?.id ?? createId(),
        type: draft.type,
        amountMinor: draft.amountMinor,
        accountId: draft.accountId,
        toAccountId: transfer ? draft.toAccountId : null,
        categoryId: transfer ? null : draft.categoryId,
        note: draft.note.trim(),
        rule: draft.rule,
        startDate,
        endDate,
        nextDate,
        paused: existing?.paused ?? false,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      if (existing === null) {
        await recurring.insert(record);
      } else {
        await recurring.update(record);
      }
      return { ok: true, id: record.id, posted: await postDue() };
    },

    /** Pausing stops postings; resuming carries on from today without back-posting the gap. */
    async setPaused(id: string, paused: boolean): Promise<void> {
      const record = await recurring.get(id);
      if (record === null || record.paused === paused) {
        return;
      }
      const today = todayKey();
      const nextDate = paused
        ? record.nextDate
        : firstOccurrenceFrom(
            record.rule,
            record.startDate,
            record.endDate,
            record.startDate > today ? record.startDate : today,
          );
      await recurring.update({ ...record, paused, nextDate, updatedAt: clock.now() });
    },

    /** Deletes a rule and returns it so the deletion can be undone. Posted transactions stay. */
    async remove(id: string): Promise<RecurringRecord> {
      const record = await recurring.get(id);
      if (record === null) {
        throw new Error(t('This recurring transaction no longer exists.'));
      }
      await recurring.delete(id);
      return record;
    },

    restore(record: RecurringRecord): Promise<void> {
      return recurring.insert(record);
    },
  };
}

export type RecurringUseCases = ReturnType<typeof createRecurringUseCases>;
