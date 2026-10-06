import { appLocale } from '@/i18n/formatting';
/**
 * Money is stored as integer minor units (cents). These helpers convert to and from text for a
 * currency, so amounts never pass through floating point arithmetic.
 */

/** Largest single amount accepted, in minor units; keeps every sum well inside safe integers. */
export const MAX_MINOR = 1_000_000_000_000;

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string): Intl.NumberFormat {
  const locale = appLocale();
  const key = `${locale}|${currency}`;
  let formatter = formatters.get(key);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
    formatters.set(key, formatter);
  }
  return formatter;
}

/** Digits after the decimal separator for a currency (2 for USD, 0 for JPY). */
export function minorDigits(currency: string): number {
  return formatterFor(currency).resolvedOptions().maximumFractionDigits ?? 2;
}

/** "$1,234.50" for 123450 in USD, in the number format of the language being shown. */
export function formatMoney(minor: number, currency: string): string {
  return formatterFor(currency).format(minor / 10 ** minorDigits(currency));
}

/** Plain editable text such as "1234.5" (or "1234.50" with `fixed`) for an amount in minor units. */
export function toAmountText(minor: number, currency: string, fixed = false): string {
  const digits = minorDigits(currency);
  const text = (minor / 10 ** digits).toFixed(digits);
  return fixed || digits === 0 ? text : text.replace(/\.?0+$/, '');
}

export interface ParseMoneyOptions {
  /** Accepts a leading minus sign, e.g. for the opening balance of a credit card. */
  allowNegative?: boolean;
}

/** True for "1", "12" and "1,234" style integers: groups of three after an optional short lead. */
function isWholeNumber(text: string, groupSeparator: string | null): boolean {
  if (groupSeparator === null) {
    return /^\d*$/.test(text);
  }
  const groups = text.split(groupSeparator);
  const [lead, ...rest] = groups;
  return /^\d{1,3}$/.test(lead ?? '') && rest.every((group) => /^\d{3}$/.test(group));
}

/**
 * Reads what a person typed ("12", "12.5", "1,234.50", "12,50") into minor units, or null when it
 * is not a valid amount. Spaces are ignored. When both "." and "," appear the last one is the
 * decimal point; a lone separator is the decimal point unless it is followed by exactly three
 * digits and the currency has fewer decimals ("1.234" is one thousand two hundred thirty-four).
 */
export function parseMoney(
  text: string,
  currency: string,
  { allowNegative = false }: ParseMoneyOptions = {},
): number | null {
  let value = text.replace(/[\s\u00a0']/g, '');
  const negative = allowNegative && value.startsWith('-');
  if (negative) {
    value = value.slice(1);
  }
  if (!/^[\d.,]+$/.test(value) || !/\d/.test(value)) {
    return null;
  }

  const digits = minorDigits(currency);
  const dots = value.split('.').length - 1;
  const commas = value.split(',').length - 1;
  let decimalSeparator: string | null = null;
  let groupSeparator: string | null = null;

  if (dots > 0 && commas > 0) {
    decimalSeparator = value.lastIndexOf('.') > value.lastIndexOf(',') ? '.' : ',';
    groupSeparator = decimalSeparator === '.' ? ',' : '.';
  } else if (dots + commas > 0) {
    const separator = dots > 0 ? '.' : ',';
    const count = dots + commas;
    const after = value.slice(value.lastIndexOf(separator) + 1);
    if (count > 1 || (after.length === 3 && digits < 3)) {
      groupSeparator = separator;
    } else {
      decimalSeparator = separator;
    }
  }

  let whole = value;
  let fraction = '';
  if (decimalSeparator !== null) {
    const at = value.lastIndexOf(decimalSeparator);
    whole = value.slice(0, at);
    fraction = value.slice(at + 1);
  }
  if (!isWholeNumber(whole, groupSeparator) && !(whole === '' && fraction !== '')) {
    return null;
  }
  if (fraction.length > digits || !/^\d*$/.test(fraction)) {
    return null;
  }

  const major = Number(groupSeparator === null ? whole : whole.split(groupSeparator).join(''));
  const total = major * 10 ** digits + Number(fraction.padEnd(digits, '0') || '0');
  if (!Number.isFinite(total) || total > MAX_MINOR) {
    return null;
  }
  return negative ? -total : total;
}
