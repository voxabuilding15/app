import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MAX_MINOR, formatMoney, minorDigits, parseMoney, toAmountText } from '@/core';

describe('minorDigits', () => {
  it('reads the decimals of a currency', () => {
    assert.equal(minorDigits('USD'), 2);
    assert.equal(minorDigits('EUR'), 2);
    assert.equal(minorDigits('JPY'), 0);
    assert.equal(minorDigits('KRW'), 0);
  });
});

describe('parseMoney', () => {
  const usd = (text: string, negative = false) =>
    parseMoney(text, 'USD', { allowNegative: negative });

  it('parses whole and decimal amounts into minor units without drift', () => {
    assert.equal(usd('12'), 1200);
    assert.equal(usd('12.5'), 1250);
    assert.equal(usd('12.50'), 1250);
    assert.equal(usd('0.07'), 7);
    assert.equal(usd('.5'), 50);
    assert.equal(usd('12.'), 1200);
    assert.equal(usd('19.99'), 1999); // 19.99 * 100 === 1998.9999999999998 in floating point
    assert.equal(usd('1.15'), 115);
  });

  it('accepts a comma as the decimal separator and handles grouping', () => {
    assert.equal(usd('12,50'), 1250);
    assert.equal(usd('1,234.50'), 123450);
    assert.equal(usd('1.234,50'), 123450);
    assert.equal(usd('1,234'), 123400);
    assert.equal(usd('1.234'), 123400);
    assert.equal(usd('1,234,567'), 123456700);
    assert.equal(usd('12.345'), 1234500); // three digits after a lone separator are grouping
    assert.equal(usd(' 1 234 '), 123400);
  });

  it('rejects text that is not an amount', () => {
    for (const text of [
      '',
      ' ',
      'abc',
      '1.2.3.4',
      '12.3456',
      '1,2345',
      '--1',
      '1e3',
      ',',
      '.',
      '12,34,56',
      '$5',
    ]) {
      assert.equal(usd(text), null, `"${text}"`);
    }
  });

  it('rejects negatives unless allowed, and caps the size', () => {
    assert.equal(usd('-5'), null);
    assert.equal(usd('-5', true), -500);
    assert.equal(usd('-0.5', true), -50);
    assert.equal(usd('99999999999.99'), null);
    assert.equal(parseMoney(String(MAX_MINOR / 100), 'USD'), MAX_MINOR);
  });

  it('respects currencies without decimals', () => {
    assert.equal(parseMoney('1500', 'JPY'), 1500);
    assert.equal(parseMoney('1.500', 'JPY'), 1500);
    assert.equal(parseMoney('15.5', 'JPY'), null);
  });
});

describe('toAmountText', () => {
  it('produces text that parses back to the same amount', () => {
    for (const minor of [0, 5, 50, 100, 1250, 123456, 99_999]) {
      assert.equal(parseMoney(toAmountText(minor, 'USD'), 'USD'), minor);
      assert.equal(parseMoney(toAmountText(minor, 'USD', true), 'USD'), minor);
    }
    assert.equal(toAmountText(1250, 'USD'), '12.5');
    assert.equal(toAmountText(1200, 'USD'), '12');
    assert.equal(toAmountText(1200, 'USD', true), '12.00');
    assert.equal(toAmountText(1500, 'JPY'), '1500');
  });
});

describe('formatMoney', () => {
  it('formats with the currency symbol and decimals', () => {
    const text = formatMoney(123450, 'USD');
    assert.match(text, /1,234\.50|1\.234,50/);
    assert.ok(text.includes('$'));
    assert.ok(formatMoney(-500, 'USD').includes('5.00'));
    assert.ok(!formatMoney(1500, 'JPY').includes('.'));
  });
});
