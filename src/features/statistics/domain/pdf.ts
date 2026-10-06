/** A tiny PDF writer: pages of text, rules and filled boxes, in the two standard fonts. */

export const PAGE_WIDTH = 595;
export const PAGE_HEIGHT = 842;

export type Rgb = readonly [number, number, number];

interface TextOptions {
  size?: number;
  bold?: boolean;
  color?: Rgb;
  /** Anchor the text's right edge at `x` instead of its left edge. */
  alignRight?: boolean;
}

const num = (value: number) => (Math.round(value * 100) / 100).toString();
const color = (rgb: Rgb) => rgb.map(num).join(' ');

/** Escapes a string for a PDF literal using only ASCII, so text is single-byte safe. */
export function escapePdfText(text: string): string {
  let out = '';
  for (const char of text.normalize('NFC')) {
    const code = char.codePointAt(0) ?? 63;
    if (char === '\\' || char === '(' || char === ')') {
      out += `\\${char}`;
    } else if (code >= 32 && code < 127) {
      out += char;
    } else if (code >= 160 && code <= 255) {
      out += `\\${code.toString(8)}`;
    } else {
      out += '?';
    }
  }
  return out;
}

/** Approximate width of text in Helvetica, in points, good enough for right alignment. */
function textWidth(text: string, size: number, bold = false): number {
  let units = 0;
  for (const char of text) {
    units += /[ilj.,:;'|!]/.test(char)
      ? 0.28
      : /[mwMW]/.test(char)
        ? 0.85
        : /[A-Z0-9]/.test(char)
          ? 0.65
          : 0.52;
  }
  return units * size * (bold ? 1.06 : 1);
}

export class PdfDocument {
  private readonly pages: string[][] = [];

  addPage(): void {
    this.pages.push([]);
  }

  get pageCount(): number {
    return this.pages.length;
  }

  private commands(): string[] {
    const page = this.pages[this.pages.length - 1];
    if (page === undefined) {
      throw new Error('Add a page first');
    }
    return page;
  }

  /** `y` is measured from the top edge of the page. */
  text(x: number, y: number, text: string, options: TextOptions = {}): void {
    const { size = 11, bold = false, color: rgb = [0.1, 0.1, 0.12], alignRight = false } = options;
    const left = alignRight ? x - textWidth(text, size, bold) : x;
    this.commands().push(
      `BT /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${color(rgb)} rg 1 0 0 1 ${num(left)} ${num(
        PAGE_HEIGHT - y,
      )} Tm (${escapePdfText(text)}) Tj ET`,
    );
  }

  /** A filled box whose top-left corner is at (x, y). */
  box(x: number, y: number, width: number, height: number, fill: Rgb): void {
    this.commands().push(
      `${color(fill)} rg ${num(x)} ${num(PAGE_HEIGHT - y - height)} ${num(width)} ${num(height)} re f`,
    );
  }

  rule(x1: number, x2: number, y: number, stroke: Rgb = [0.8, 0.8, 0.82]): void {
    this.commands().push(
      `${color(stroke)} RG 0.5 w ${num(x1)} ${num(PAGE_HEIGHT - y)} m ${num(x2)} ${num(PAGE_HEIGHT - y)} l S`,
    );
  }

  /** The finished file as bytes. */
  build(title: string): Uint8Array {
    const objects: string[] = [];
    const pageIds = this.pages.map((_, index) => 5 + index * 2);
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
    objects[3] =
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[4] =
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    this.pages.forEach((commands, index) => {
      const pageId = 5 + index * 2;
      const stream = commands.join('\n');
      objects[pageId] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
      objects[pageId + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });
    const infoId = objects.length;
    objects[infoId] = `<< /Title (${escapePdfText(title)}) /Producer (FocusFlow) >>`;

    let out = '%PDF-1.4\n';
    const offsets: number[] = [];
    for (let id = 1; id < objects.length; id += 1) {
      offsets[id] = out.length;
      out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xref = out.length;
    out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id += 1) {
      out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    }
    out += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

    const bytes = new Uint8Array(out.length);
    for (let index = 0; index < out.length; index += 1) {
      bytes[index] = out.charCodeAt(index) & 0xff;
    }
    return bytes;
  }
}
