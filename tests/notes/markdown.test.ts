import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyBlock,
  applyInline,
  continueList,
  typedNewlineCaret,
  type Selection,
} from '@/features/notes/domain/formatting';
import {
  excerptOf,
  normalizeBody,
  parseInline,
  parseMarkdown,
  plainText,
  toggleTask,
} from '@/features/notes/domain/markdown';

const runs = (text: string) =>
  parseInline(text).map((inline) => {
    const flags = (['bold', 'italic', 'underline', 'strike', 'code'] as const).filter(
      (key) => inline[key],
    );
    return inline.type === 'link'
      ? [inline.text, 'link:' + inline.url, ...flags]
      : [inline.text, ...flags];
  });

describe('parseInline', () => {
  it('reads each style on its own', () => {
    assert.deepEqual(runs('a **bold** b'), [['a '], ['bold', 'bold'], [' b']]);
    assert.deepEqual(runs('*it* and _it_'), [['it', 'italic'], [' and '], ['it', 'italic']]);
    assert.deepEqual(runs('<u>under</u>'), [['under', 'underline']]);
    assert.deepEqual(runs('~~gone~~'), [['gone', 'strike']]);
    assert.deepEqual(runs('use `code` here'), [['use '], ['code', 'code'], [' here']]);
  });

  it('nests styles', () => {
    assert.deepEqual(runs('**bold *and italic* too**'), [
      ['bold ', 'bold'],
      ['and italic', 'bold', 'italic'],
      [' too', 'bold'],
    ]);
    assert.deepEqual(runs('<u>**x**</u>'), [['x', 'bold', 'underline']]);
  });

  it('leaves unclosed or empty markers as literal text', () => {
    assert.deepEqual(runs('**unclosed'), [['**unclosed']]);
    assert.deepEqual(runs('a * b'), [['a * b']]);
    assert.deepEqual(runs('****'), [['****']]);
    assert.deepEqual(runs('snake_case_name'), [['snake_case_name']]);
    assert.deepEqual(runs('2 * 3 * 4'), [['2 * 3 * 4']]);
    assert.deepEqual(runs('a * b*c'), [['a * b*c']], 'an opener followed by a space is not an opener');
  });

  it('does not style inside code spans', () => {
    assert.deepEqual(runs('`**not bold**`'), [['**not bold**', 'code']]);
    assert.deepEqual(runs('*a `*` b*'), [
      ['a ', 'italic'],
      ['*', 'italic', 'code'],
      [' b', 'italic'],
    ]);
  });

  it('honours escapes', () => {
    assert.deepEqual(runs('\\*literal\\*'), [['*literal*']]);
    assert.deepEqual(runs('a \\_ b'), [['a _ b']]);
  });

  it('reads links, accepting only safe schemes', () => {
    assert.deepEqual(runs('see [docs](https://x.dev/a?b=1) now'), [
      ['see '],
      ['docs', 'link:https://x.dev/a?b=1'],
      [' now'],
    ]);
    assert.deepEqual(runs('[mail](mailto:a@b.c)'), [['mail', 'link:mailto:a@b.c']]);
    assert.deepEqual(runs('[bad](javascript:alert(1))'), [['[bad](javascript:alert(1))']]);
    assert.deepEqual(runs('[**b**](https://x.dev)').length, 1);
  });

  it('copes with empty and odd input', () => {
    assert.deepEqual(parseInline(''), []);
    assert.deepEqual(runs('[]()'), [['[]()']]);
    assert.deepEqual(runs('日本語 **太字**'), [['日本語 '], ['太字', 'bold']]);
  });
});

describe('parseMarkdown', () => {
  const types = (source: string) => parseMarkdown(source).map((block) => block.type);

  it('recognises every block type and keeps source line numbers', () => {
    const blocks = parseMarkdown(
      [
        '# Title',
        '',
        'Plain text',
        '- bullet',
        '1. first',
        '- [ ] todo',
        '- [x] done',
        '> quote',
        '---',
        '```',
        'code',
        '```',
        '## Sub',
      ].join('\n'),
    );
    assert.deepEqual(
      blocks.map((block) => [block.type, block.line]),
      [
        ['heading', 0],
        ['paragraph', 2],
        ['bullet', 3],
        ['ordered', 4],
        ['task', 5],
        ['task', 6],
        ['quote', 7],
        ['rule', 8],
        ['code', 9],
        ['heading', 12],
      ],
    );
    assert.deepEqual(
      blocks
        .filter((block) => block.type === 'heading')
        .map((block) => (block.type === 'heading' ? block.level : 0)),
      [1, 2],
    );
  });

  it('reads task state, ordering and indentation', () => {
    const [a, b, c] = parseMarkdown('- [X] a\n  - [ ] b\n3. c');
    assert.deepEqual(
      [a?.type === 'task' && a.checked, b?.type === 'task' && [b.checked, b.indent]],
      [true, [false, 1]],
    );
    assert.equal(c?.type === 'ordered' && c.number, 3);
  });

  it('keeps fenced code verbatim and tolerates an unclosed fence', () => {
    const [code] = parseMarkdown('```\n# not a heading\n**x**\n```');
    assert.equal(code?.type === 'code' && code.text, '# not a heading\n**x**');
    assert.deepEqual(types('```\nopen'), ['code']);
  });

  it('does not treat hashes without a space, or four-level headings, as headings', () => {
    assert.deepEqual(types('#tag'), ['paragraph']);
    assert.deepEqual(types('#### four'), ['paragraph']);
    assert.deepEqual(types('-not a bullet'), ['paragraph']);
  });

  it('handles empty input and Windows line endings', () => {
    assert.deepEqual(parseMarkdown(''), []);
    assert.deepEqual(types('a\r\n- b\r\n'), ['paragraph', 'bullet']);
  });
});

describe('plain text, excerpts and checklists', () => {
  const sample =
    '# Plan\n\nBuy **milk** and [bread](https://x.dev)\n- [x] done\n- [ ] todo\n- item\n1. one';

  it('strips the syntax', () => {
    assert.equal(plainText(sample), 'Plan\nBuy milk and bread\n☑ done\n☐ todo\n• item\n1. one');
  });

  it('shortens to one line with an ellipsis', () => {
    assert.equal(
      excerptOf(sample, 200),
      'Plan · Buy milk and bread · ☑ done · ☐ todo · • item · 1. one',
    );
    assert.equal(excerptOf(sample, 10), 'Plan · Bu…');
    assert.equal(excerptOf('', 10), '');
    assert.equal(excerptOf('short', 10), 'short');
  });

  it('toggles one task and leaves everything else alone', () => {
    assert.equal(toggleTask('- [ ] a\n- [x] b', 0), '- [x] a\n- [x] b');
    assert.equal(toggleTask('- [ ] a\n- [x] b', 1), '- [ ] a\n- [ ] b');
    assert.equal(toggleTask('  - [ ] nested', 0), '  - [x] nested');
    assert.equal(toggleTask('plain\n- [ ] a', 0), 'plain\n- [ ] a');
    assert.equal(toggleTask('- [ ] a', 5), '- [ ] a');
    assert.equal(toggleTask('- [X] a', 0), '- [ ] a');
  });

  it('normalises line endings and the task marker', () => {
    assert.equal(normalizeBody('- [X] a\r\n  - [X] b\rc'), '- [x] a\n  - [x] b\nc');
  });
});

const at = (start: number, end = start): Selection => ({ start, end });
const mark = (text: string, selection: Selection) =>
  text.slice(0, selection.start) +
  '|' +
  text.slice(selection.start, selection.end) +
  '|' +
  text.slice(selection.end);

describe('applyInline', () => {
  it('wraps a selection and keeps it selected', () => {
    const result = applyInline('hello world', at(6, 11), 'bold');
    assert.equal(result.text, 'hello **world**');
    assert.equal(mark(result.text, result.selection), 'hello **|world|**');
  });

  it('inserts an empty pair with the caret between when nothing is selected', () => {
    for (const [format, pair] of [
      ['bold', '****'],
      ['italic', '**'],
      ['underline', '<u></u>'],
      ['strike', '~~~~'],
      ['code', '``'],
    ] as const) {
      const result = applyInline('ab', at(1), format);
      assert.equal(result.text, `a${pair}b`, format);
      const half = pair.length / 2;
      assert.equal(result.selection.start, 1 + (format === 'underline' ? 3 : half), format);
      assert.equal(result.selection.start, result.selection.end);
    }
  });

  it('toggles off when the markers surround the selection or are part of it', () => {
    assert.deepEqual(applyInline('a **b** c', at(4, 5), 'bold'), {
      text: 'a b c',
      selection: at(2, 3),
    });
    assert.deepEqual(applyInline('a **b** c', at(2, 7), 'bold'), {
      text: 'a b c',
      selection: at(2, 3),
    });
    assert.equal(applyInline('<u>x</u>', at(3, 4), 'underline').text, 'x');
  });

  it('is its own inverse', () => {
    const wrapped = applyInline('some text', at(5, 9), 'italic');
    assert.equal(applyInline(wrapped.text, wrapped.selection, 'italic').text, 'some text');
  });

  it('applies different styles on top of each other', () => {
    const bold = applyInline('word', at(0, 4), 'bold');
    const both = applyInline(bold.text, bold.selection, 'underline');
    assert.equal(both.text, '**<u>word</u>**');
    assert.deepEqual(
      parseInline(both.text).map((i) => [i.text, i.type === 'text' && i.bold && i.underline]),
      [['word', true]],
    );
  });

  it('clamps selections that are out of range or reversed', () => {
    assert.equal(applyInline('abc', at(2, 99), 'bold').text, 'ab**c**');
    assert.equal(applyInline('abc', at(-5, 1), 'bold').text, '**a**bc');
    assert.equal(applyInline('abc', { start: 3, end: 1 }, 'bold').text, 'a**bc**');
    assert.equal(applyInline('', at(0), 'bold').text, '****');
  });
});

describe('applyBlock', () => {
  it('adds and removes a heading on the current line', () => {
    assert.equal(applyBlock('Title\nbody', at(2), 'h1').text, '# Title\nbody');
    assert.equal(applyBlock('# Title\nbody', at(3), 'h1').text, 'Title\nbody');
    assert.equal(applyBlock('# Title', at(3), 'h2').text, '## Title');
    assert.equal(applyBlock('### Title', at(3), 'h3').text, 'Title');
  });

  it('keeps the caret on the same text', () => {
    const result = applyBlock('Title', at(3), 'h1');
    assert.equal(result.text, '# Title');
    assert.equal(result.selection.start, 5);
    const back = applyBlock(result.text, result.selection, 'h1');
    assert.deepEqual(back, { text: 'Title', selection: at(3) });
  });

  it('formats every selected line, numbering lists', () => {
    assert.equal(applyBlock('a\nb\nc', at(0, 5), 'bullet').text, '- a\n- b\n- c');
    assert.equal(applyBlock('a\nb\nc', at(0, 5), 'ordered').text, '1. a\n2. b\n3. c');
    assert.equal(applyBlock('a\nb\nc', at(2, 3), 'task').text, 'a\n- [ ] b\nc');
    assert.equal(applyBlock('a\nb', at(0, 3), 'quote').text, '> a\n> b');
  });

  it('removes the format only when every line has it', () => {
    assert.equal(applyBlock('- a\n- b', at(0, 7), 'bullet').text, 'a\nb');
    assert.equal(
      applyBlock('- a\nb', at(0, 5), 'bullet').text,
      '- a\n- b',
      'mixed lines all become bullets',
    );
  });

  it('converts between list kinds and headings', () => {
    assert.equal(applyBlock('- a', at(1), 'task').text, '- [ ] a');
    assert.equal(applyBlock('- [x] a', at(1), 'bullet').text, '- a');
    assert.equal(applyBlock('1. a', at(1), 'bullet').text, '- a');
    assert.equal(applyBlock('- a', at(1), 'h2').text, '## a');
    assert.equal(applyBlock('# a', at(1), 'quote').text, '> a');
  });

  it('keeps indentation for lists but not headings', () => {
    assert.equal(applyBlock('  a', at(2), 'bullet').text, '  - a');
    assert.equal(applyBlock('  - a', at(4), 'bullet').text, '  a');
  });

  it('does not include the next line when the selection ends at its start', () => {
    assert.equal(applyBlock('a\nb', at(0, 2), 'bullet').text, '- a\nb');
  });

  it('works on empty text and out-of-range selections', () => {
    assert.equal(applyBlock('', at(0), 'bullet').text, '- ');
    assert.equal(applyBlock('a', at(50), 'h1').text, '# a');
  });
});

describe('continueList', () => {
  const press = (before: string, caret: number) => {
    const next = before.slice(0, caret) + '\n' + before.slice(caret);
    return continueList(before, next, caret + 1);
  };

  it('continues bullets, numbers and tasks', () => {
    assert.deepEqual(press('- one', 5), { text: '- one\n- ', selection: at(8) });
    assert.deepEqual(press('1. one', 6), { text: '1. one\n2. ', selection: at(10) });
    assert.deepEqual(press('- [x] one', 9), { text: '- [x] one\n- [ ] ', selection: at(16) });
    assert.deepEqual(press('  - nested', 10), { text: '  - nested\n  - ', selection: at(15) });
    assert.equal(press('* star', 6)?.text, '* star\n* ');
  });

  it('ends the list on an empty item', () => {
    assert.deepEqual(press('- one\n- ', 8), { text: '- one\n', selection: at(6) });
    assert.deepEqual(press('- [ ] ', 6), { text: '', selection: at(0) });
  });

  it('continues from the middle of a list', () => {
    const result = press('- a\n- b', 3);
    assert.equal(result?.text, '- a\n- \n- b');
  });

  it('ignores plain lines and anything that is not a single newline', () => {
    assert.equal(press('plain', 5), null);
    assert.equal(continueList('- a', '- ab', 4), null);
    assert.equal(continueList('- a', '- a\n\n', 5), null);
    assert.equal(continueList('x', 'y\n', 2), null);
  });
});

describe('typedNewlineCaret', () => {
  it('finds the caret after a typed newline', () => {
    assert.equal(typedNewlineCaret('ab', 'a\nb'), 2);
    assert.equal(typedNewlineCaret('ab', 'ab\n'), 3);
    assert.equal(typedNewlineCaret('', '\n'), 1);
    assert.equal(typedNewlineCaret('a\nb', 'a\n\nb'), 3);
  });

  it('ignores every other edit', () => {
    assert.equal(typedNewlineCaret('ab', 'ac b'), null);
    assert.equal(typedNewlineCaret('ab', 'abc'), null);
    assert.equal(typedNewlineCaret('ab', 'a'), null);
    assert.equal(typedNewlineCaret('ab', 'xyz'), null);
  });
});
