/** Sketches are saved as small JSON files of strokes, so they stay editable and render as vectors. */

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  color: string;
  width: number;
  points: Point[];
}

export interface Drawing {
  /** The canvas size the points are relative to. */
  width: number;
  height: number;
  strokes: Stroke[];
}

export const DRAWING_MIME = 'application/vnd.focusflow.drawing+json';
const FORMAT_VERSION = 1;
const MAX_STROKES = 2_000;
const MAX_POINTS = 20_000;

export function serializeDrawing(drawing: Drawing): string {
  return JSON.stringify({ version: FORMAT_VERSION, ...drawing });
}

function isPoint(value: unknown): value is Point {
  const point = value as Point;
  return (
    typeof point?.x === 'number' &&
    typeof point?.y === 'number' &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y)
  );
}

/** Reads a saved sketch, dropping anything malformed instead of failing; null if unusable. */
export function parseDrawing(text: string): Drawing | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const data = raw as Partial<Drawing> & { version?: number };
  if (data?.version !== FORMAT_VERSION || !Array.isArray(data.strokes)) {
    return null;
  }
  const width = Number(data.width);
  const height = Number(data.height);
  if (!(width > 0) || !(height > 0)) {
    return null;
  }
  const strokes: Stroke[] = [];
  let points = 0;
  for (const stroke of data.strokes.slice(0, MAX_STROKES)) {
    if (
      typeof stroke?.color !== 'string' ||
      !(Number(stroke.width) > 0) ||
      !Array.isArray(stroke.points)
    ) {
      continue;
    }
    const valid = stroke.points.filter(isPoint).slice(0, Math.max(0, MAX_POINTS - points));
    points += valid.length;
    if (valid.length > 0) {
      strokes.push({ color: stroke.color, width: Number(stroke.width), points: valid });
    }
  }
  return { width, height, strokes };
}

const round = (value: number) => Math.round(value * 10) / 10;

/** SVG path data for a stroke: a dot for one point, otherwise a smooth curve through the points. */
export function strokePath(points: readonly Point[]): string {
  const [first, ...rest] = points;
  if (first === undefined) {
    return '';
  }
  if (rest.length === 0) {
    return `M${round(first.x)} ${round(first.y)}l0.01 0`;
  }
  let path = `M${round(first.x)} ${round(first.y)}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index] as Point;
    const next = points[index + 1] as Point;
    path += `Q${round(current.x)} ${round(current.y)} ${round((current.x + next.x) / 2)} ${round((current.y + next.y) / 2)}`;
  }
  const last = points[points.length - 1] as Point;
  return `${path}L${round(last.x)} ${round(last.y)}`;
}

/** Drops points that are closer than `minDistance` to the previous one, always keeping the last. */
export function thin(points: readonly Point[], minDistance: number): Point[] {
  const kept: Point[] = [];
  points.forEach((point, index) => {
    const previous = kept[kept.length - 1];
    const isLast = index === points.length - 1;
    if (
      previous === undefined ||
      isLast ||
      Math.hypot(point.x - previous.x, point.y - previous.y) >= minDistance
    ) {
      kept.push(point);
    }
  });
  return kept;
}
