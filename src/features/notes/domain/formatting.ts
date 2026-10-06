import { LINE } from './markdown';

export interface Selection {
  start: number;
  end: number;
}

export interface EditResult {
  text: string;
  selection: Selection;
}

export type InlineFormat = 'bold' | 'italic' | 'underline' | 'strike' | 'code';
export type BlockFormat = 'h1' | 'h2' | 'h3' | 'bullet' | 'ordered' | 'task' | 'quote';

const WRAPPERS: Record<InlineFormat, readonly [string, string]> = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  underline: ['<u>', '</u>'],
  strike: ['~~', '~~'],
  code: ['`', '`'],
};

function clamp(selection: Selection, length: number): Selection {
  const start = Math.max(0, Math.min(selection.start, selection.end, length));
  const end = Math.max(start, Math.min(Math.max(selection.start, selection.end), length));
  return { start, end };
}

/**
 * Applies or removes bold, italic and the other inline styles. With nothing selected it inserts an
 * empty pair of markers and puts the cursor between them.
 */
export function applyInline(text: string, selection: Selection, format: InlineFormat): EditResult {
  const { start, end } = clamp(selection, text.length);
  const [open, close] = WRAPPERS[format];
  const selected = text.slice(start, end);

  // Markers just outside the selection: remove them.
  if (
    text.slice(start - open.length, start) === open &&
    text.slice(end, end + close.length) === close &&
    start >= open.length
  ) {
    return {
      text: text.slice(0, start - open.length) + selected + text.slice(end + close.length),
      selection: { start: start - open.length, end: end - open.length },
    };
  }
  // The selection includes its own markers: remove them.
  if (
    selected.length >= open.length + close.length &&
    selected.startsWith(open) &&
    selected.endsWith(close)
  ) {
    const inner = selected.slice(open.length, selected.length - close.length);
    return {
      text: text.slice(0, start) + inner + text.slice(end),
      selection: { start, end: start + inner.length },
    };
  }
  return {
    text: text.slice(0, start) + open + selected + close + text.slice(end),
    selection:
      start === end
        ? { start: start + open.length, end: start + open.length }
        : { start: start + open.length, end: end + open.length },
  };
}

interface LineSpan {
  index: number;
  start: number;
  end: number;
  text: string;
}

function linesTouching(text: string, { start, end }: Selection): LineSpan[] {
  const spans: LineSpan[] = [];
  let offset = 0;
  text.split('\n').forEach((line, index) => {
    const lineStart = offset;
    const lineEnd = offset + line.length;
    // A selection ending exactly at the start of the next line does not include that line.
    const touches = lineEnd >= start && (lineStart < end || lineStart <= start);
    if (touches && !(end > start && lineStart === end)) {
      spans.push({ index, start: lineStart, end: lineEnd, text: line });
    }
    offset = lineEnd + 1;
  });
  return spans;
}

const PREFIX_PATTERNS: readonly RegExp[] = [
  /^#{1,3} /,
  /^(\s*)- \[[ xX]\] /,
  /^(\s*)[-*+] /,
  /^(\s*)\d+\. /,
  /^> ?/,
];

/** The line without any heading, list or quote prefix, plus its indentation. */
function stripPrefix(line: string): { indent: string; content: string } {
  for (const pattern of PREFIX_PATTERNS) {
    const match = pattern.exec(line);
    if (match) {
      return {
        indent: (match[1] as string | undefined) ?? '',
        content: line.slice(match[0].length),
      };
    }
  }
  return { indent: /^\s*/.exec(line)?.[0] ?? '', content: line.trimStart() };
}

function hasFormat(line: string, format: BlockFormat): boolean {
  switch (format) {
    case 'h1':
      return line.startsWith('# ');
    case 'h2':
      return line.startsWith('## ');
    case 'h3':
      return line.startsWith('### ');
    case 'bullet':
      return LINE.bullet.test(line) && !LINE.task.test(line);
    case 'ordered':
      return LINE.ordered.test(line);
    case 'task':
      return LINE.task.test(line);
    default:
      return LINE.quote.test(line) && line.startsWith('>');
  }
}

function prefixFor(format: BlockFormat, position: number): string {
  switch (format) {
    case 'h1':
      return '# ';
    case 'h2':
      return '## ';
    case 'h3':
      return '### ';
    case 'bullet':
      return '- ';
    case 'ordered':
      return `${position + 1}. `;
    case 'task':
      return '- [ ] ';
    default:
      return '> ';
  }
}

/**
 * Turns the lines touched by the selection into a heading, list or quote, or back into plain
 * paragraphs when every one of them already has that format.
 */
export function applyBlock(text: string, selection: Selection, format: BlockFormat): EditResult {
  const range = clamp(selection, text.length);
  const spans = linesTouching(text, range);
  if (spans.length === 0) {
    return { text, selection: range };
  }
  const remove = spans.every((span) => hasFormat(span.text, format));
  const lines = text.split('\n');
  let startShift = 0;
  let endShift = 0;

  spans.forEach((span, position) => {
    const { indent, content } = stripPrefix(span.text);
    const keepIndent =
      format === 'h1' || format === 'h2' || format === 'h3' || format === 'quote' ? '' : indent;
    const next = remove
      ? `${keepIndent}${content}`
      : `${keepIndent}${prefixFor(format, position)}${content}`;
    lines[span.index] = next;
    const change = next.length - span.text.length;
    if (span.start <= range.start) {
      startShift += change;
    }
    if (span.start <= range.end) {
      endShift += change;
    }
  });

  const first = spans[0] as LineSpan;
  return {
    text: lines.join('\n'),
    selection: {
      start: Math.max(
        first.start,
        range.start + (range.start === range.end ? endShift : startShift),
      ),
      end: Math.max(first.start, range.end + endShift),
    },
  };
}

/**
 * Keeps a list going when Enter is pressed: a new bullet, number or task appears under a list
 * item, and pressing Enter on an empty item ends the list. Returns null when `next` is not the
 * result of typing a single newline.
 */
export function continueList(previous: string, next: string, caret: number): EditResult | null {
  if (next.length !== previous.length + 1 || next[caret - 1] !== '\n') {
    return null;
  }
  if (next.slice(0, caret - 1) + next.slice(caret) !== previous) {
    return null;
  }
  const lineStart = next.lastIndexOf('\n', caret - 2) + 1;
  const line = next.slice(lineStart, caret - 1);

  const task = LINE.task.exec(line);
  const bullet = LINE.bullet.exec(line);
  const ordered = LINE.ordered.exec(line);
  if (!task && !bullet && !ordered) {
    return null;
  }

  const content = task
    ? (task[3] as string)
    : bullet
      ? (bullet[2] as string)
      : (ordered?.[3] as string);
  if (content.trim() === '') {
    // Enter on an empty item removes the marker and ends the list.
    const text = next.slice(0, lineStart) + next.slice(caret);
    return { text, selection: { start: lineStart, end: lineStart } };
  }

  const indent = (task?.[1] ?? bullet?.[1] ?? ordered?.[1]) as string;
  const marker = task
    ? '- [ ] '
    : bullet
      ? `${(/^\s*([-*+])/.exec(line)?.[1] as string) ?? '-'} `
      : `${Number(ordered?.[2]) + 1}. `;
  const insert = `${indent}${marker}`;
  return {
    text: next.slice(0, caret) + insert + next.slice(caret),
    selection: { start: caret + insert.length, end: caret + insert.length },
  };
}

/**
 * Where the cursor ended up when `next` is `previous` with a single newline typed into it, or
 * null for any other edit. Lets the editor continue lists even though a text change carries no
 * cursor position.
 */
export function typedNewlineCaret(previous: string, next: string): number | null {
  if (next.length !== previous.length + 1) {
    return null;
  }
  let index = 0;
  while (index < previous.length && previous[index] === next[index]) {
    index += 1;
  }
  return next[index] === '\n' && next.slice(index + 1) === previous.slice(index) ? index + 1 : null;
}
