import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import { constantTimeEquals, sha256Hex, stretchedHash } from '@/core/hash';

const reference = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

describe('sha256', () => {
  it('matches the platform implementation for inputs around the block boundaries', () => {
    for (const length of [0, 1, 3, 54, 55, 56, 57, 63, 64, 65, 119, 120, 128, 1000]) {
      const text = 'a'.repeat(length);
      assert.equal(sha256Hex(text), reference(text), `length ${length}`);
    }
  });

  it('hashes unicode as UTF-8', () => {
    for (const text of ['héllo', '日本語', 'emoji 😀 text', 'ñ'.repeat(40)]) {
      assert.equal(sha256Hex(text), reference(text), text);
    }
  });

  it('matches the published test vectors', () => {
    assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.equal(
      sha256Hex('abc'),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('stretchedHash', () => {
  it('depends on the salt, the secret and the number of rounds, and is repeatable', () => {
    const base = stretchedHash('1234', 'salt', 50);
    assert.equal(stretchedHash('1234', 'salt', 50), base);
    assert.notEqual(stretchedHash('1235', 'salt', 50), base);
    assert.notEqual(stretchedHash('1234', 'pepper', 50), base);
    assert.notEqual(stretchedHash('1234', 'salt', 51), base);
    assert.match(base, /^[0-9a-f]{64}$/);
  });

  it('is a single salted hash for one round', () => {
    assert.equal(stretchedHash('1234', 's', 1), reference('s:1234'));
  });
});

describe('constantTimeEquals', () => {
  it('compares whole strings', () => {
    assert.equal(constantTimeEquals('abc', 'abc'), true);
    assert.equal(constantTimeEquals('abc', 'abd'), false);
    assert.equal(constantTimeEquals('abc', 'abcd'), false);
    assert.equal(constantTimeEquals('', ''), true);
  });
});
