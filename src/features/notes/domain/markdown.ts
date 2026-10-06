/**
 * A small Markdown dialect for notes, parsed without any dependency. Supported: headings (# to ###),
 * **bold**, *italic* or _italic_, <u>underline</u>, ~~strikethrough~~, `code`, fenced code blocks,
 * [links](https://example.com), bullet and numbered lists, > quotes, --- rules and "- [ ]" task
 * lists. Anything else is shown as typed.
 */

interface InlineStyle {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
}

export type Inline =
  | ({ type: 'text'; text: string } & InlineStyle)
  | ({ type: 'link'; text: string; url: string } & InlineStyle);

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; inlines: Inline[]; line: number }
  | { type: 'paragraph'; inlines: Inline[]; line: number }
  | { type: 'bullet'; indent: number; inlines: Inline[]; line: number }
  | { type: 'ordered'; indent: number; number: number; inlines: Inline[]; line: number }
  | { type: 'task'; indent: number; checked: boolean; inlines: Inline[]; line: number }
  | { type: 'quote'; inlines: Inline[]; line: number }
  | { type: 'rule'; line: number }
  | { type: 'code'; text: string; line: number };

const PLAIN: InlineStyle = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
};

/** Line patterns, shared by the parser and the editor commands. */
export const LINE = {
  heading: /^(#{1,3}) (.*)$/,
  task: /^(\s*)- \[([ xX])\] ?(.*)$/,
  bullet: /^(\s*)[-*+] (.*)$/,
  ordered: /^(\s*)(\d+)\. (.*)$/,
  quote: /^> ?(.*)$/,
  rule: /^\s*(?:---+|\*\*\*+|___+)\s*$/,
  fence: /^```/,
} as const;

const SAFE_URL = /^(https?:\/\/|mailto:|tel:)/i;

function isSpace(char: string | undefined): boolean {
  return char === undefined || /\s/.test(char);
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char);
}

interface Marker {
  token: string;
  apply: (style: InlineStyle) => InlineStyle;
}

const MARKERS: readonly Marker[] = [
  { token: '**', apply: (style) => ({ ...style, bold: true }) },
  { token: '~~', apply: (style) => ({ ...style, strike: true }) },
  { token: '<u>', apply: (style) => ({ ...style, underline: true }) },
  { token: '*', apply: (style) => ({ ...style, italic: true }) },
  { token: '_', apply: (style) => ({ ...style, italic: true }) },
];

function closerOf(token: string): string {
  return token === '<u>' ? '</u>' : token;
}

/** Index of the closing marker for an opener at `from`, or -1 when it is never closed. */
function findCloser(text: string, token: string, from: number): number {
  const closer = closerOf(token);
  for (let index = from; index < text.length; index += 1) {
    if (text.startsWith('`', index)) {
      const end = text.indexOf('`', index + 1);
      if (end === -1) {
        return -1;
      }
      index = end;
      continue;
    }
    if (!text.startsWith(closer, index) || isSpace(text[index - 1])) {
      continue;
    }
    // A single * must not close on the first half of **, and _ only closes at a word edge.
    if (token === '*' && text.startsWith('**', index)) {
      index += 1;
      continue;
    }
    if (token === '_' && isWordChar(text[index + 1])) {
      continue;
    }
    return index > from ? index : -1;
  }
  return -1;
}

function pushText(out: Inline[], text: string, style: InlineStyle): void {
  if (text === '') {
    return;
  }
  const last = out[out.length - 1];
  if (
    last?.type === 'text' &&
    JSON.stringify({ ...last, text: '' }) === JSON.stringify({ type: 'text', text: '', ...style })
  ) {
    last.text += text;
    return;
  }
  out.push({ type: 'text', text, ...style });
}

/** Splits one line of text into styled runs. Unclosed markers stay as literal characters. */
export function parseInline(text: string, style: InlineStyle = PLAIN): Inline[] {
  const out: Inline[] = [];
  let buffer = '';
  const flush = () => {
    pushText(out, buffer, style);
    buffer = '';
  };

  for (let index = 0; index < text.length;) {
    const char = text[index] as string;

    if (
      char === '\\' &&
      index + 1 < text.length &&
      /[\\`*_~[\]<>#-]/.test(text[index + 1] as string)
    ) {
      buffer += text[index + 1];
      index += 2;
      continue;
    }

    if (char === '`') {
      const end = text.indexOf('`', index + 1);
      if (end > index + 1) {
        flush();
        out.push({ type: 'text', text: text.slice(index + 1, end), ...style, code: true });
        index = end + 1;
        continue;
      }
    }

    if (char === '[') {
      const match = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(text.slice(index));
      if (match && SAFE_URL.test(match[2] as string)) {
        flush();
        out.push({ type: 'link', text: match[1] as string, url: match[2] as string, ...style });
        index += match[0].length;
        continue;
      }
    }

    const marker = MARKERS.find((candidate) => text.startsWith(candidate.token, index));
    if (marker) {
      // Like Markdown, an opener must be followed by text, and "_" cannot start inside a word.
      const intraword = marker.token === '_' && isWordChar(text[index - 1]);
      const blocked = intraword || isSpace(text[index + marker.token.length]);
      const end = blocked ? -1 : findCloser(text, marker.token, index + marker.token.length);
      if (end !== -1) {
        flush();
        const inner = text.slice(index + marker.token.length, end);
        out.push(...parseInline(inner, marker.apply(style)));
        index = end + closerOf(marker.token).length;
        continue;
      }
    }

    buffer += char;
    index += 1;
  }
  flush();
  return out;
}

/** Normalises what is stored: Unix line endings and a lower-case x in finished tasks. */
export function normalizeBody(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/^(\s*- \[)X(\])/gm, '$1x$2');
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = normalizeBody(source).split('\n');

  for (let line = 0; line < lines.length; line += 1) {
    const text = lines[line] as string;

    if (LINE.fence.test(text)) {
      const code: string[] = [];
      const start = line;
      for (line += 1; line < lines.length && !LINE.fence.test(lines[line] as string); line += 1) {
        code.push(lines[line] as string);
      }
      blocks.push({ type: 'code', text: code.join('\n'), line: start });
      continue;
    }
    if (text.trim() === '') {
      continue;
    }
    if (LINE.rule.test(text)) {
      blocks.push({ type: 'rule', line });
      continue;
    }

    let match = LINE.heading.exec(text);
    if (match) {
      blocks.push({
        type: 'heading',
        level: (match[1] as string).length as 1 | 2 | 3,
        inlines: parseInline(match[2] as string),
        line,
      });
      continue;
    }
    match = LINE.task.exec(text);
    if (match) {
      blocks.push({
        type: 'task',
        indent: indentLevel(match[1] as string),
        checked: match[2] !== ' ',
        inlines: parseInline(match[3] as string),
        line,
      });
      continue;
    }
    match = LINE.bullet.exec(text);
    if (match) {
      blocks.push({
        type: 'bullet',
        indent: indentLevel(match[1] as string),
        inlines: parseInline(match[2] as string),
        line,
      });
      continue;
    }
    match = LINE.ordered.exec(text);
    if (match) {
      blocks.push({
        type: 'ordered',
        indent: indentLevel(match[1] as string),
        number: Number(match[2]),
        inlines: parseInline(match[3] as string),
        line,
      });
      continue;
    }
    match = LINE.quote.exec(text);
    if (match) {
      blocks.push({ type: 'quote', inlines: parseInline(match[1] as string), line });
      continue;
    }
    blocks.push({ type: 'paragraph', inlines: parseInline(text), line });
  }
  return blocks;
}

function indentLevel(whitespace: string): number {
  return Math.min(3, Math.floor(whitespace.replace(/\t/g, '  ').length / 2));
}

function inlineText(inlines: readonly Inline[]): string {
  return inlines.map((inline) => inline.text).join('');
}

/** The text of a note without any Markdown syntax, for previews and search results. */
export function plainText(source: string): string {
  return parseMarkdown(source)
    .map((block) => {
      switch (block.type) {
        case 'rule':
          return '';
        case 'code':
          return block.text;
        case 'task':
          return `${block.checked ? '☑' : '☐'} ${inlineText(block.inlines)}`;
        case 'bullet':
          return `• ${inlineText(block.inlines)}`;
        case 'ordered':
          return `${block.number}. ${inlineText(block.inlines)}`;
        default:
          return inlineText(block.inlines);
      }
    })
    .filter((line) => line !== '')
    .join('\n');
}

/** A single-line summary of at most `max` characters. */
export function excerptOf(source: string, max: number): string {
  const flat = plainText(source)
    .replace(/\s*\n\s*/g, ' · ')
    .trim();
  return flat.length <= max ? flat : `${flat.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Ticks or unticks the task on a source line; any other line is left alone. */
export function toggleTask(source: string, line: number): string {
  const lines = normalizeBody(source).split('\n');
  const text = lines[line];
  if (text === undefined) {
    return source;
  }
  const match = LINE.task.exec(text);
  if (!match) {
    return source;
  }
  lines[line] = `${match[1]}- [${match[2] === ' ' ? 'x' : ' '}] ${match[3]}`;
  return lines.join('\n');
}
