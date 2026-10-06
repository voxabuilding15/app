import Svg, { Path, Rect } from 'react-native-svg';

import { strokePath, type Drawing, type Stroke } from '../../domain/drawing';

/** Logical size of the drawing canvas; strokes are stored in these units and scaled to fit. */
export const CANVAS_SIZE = 1000;
const PAPER_COLOR = '#FFFFFF';

interface DrawingSvgProps {
  strokes: readonly Stroke[];
  size: number;
  /** Spoken description, e.g. "Drawing with 3 strokes". */
  label?: string;
}

/** A sketch drawn on white paper, as vectors. */
export function DrawingSvg({ strokes, size, label }: DrawingSvgProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
      accessible={label !== undefined}
      accessibilityLabel={label}
      accessibilityRole={label === undefined ? undefined : 'image'}
    >
      <Rect x={0} y={0} width={CANVAS_SIZE} height={CANVAS_SIZE} fill={PAPER_COLOR} />
      {strokes.map((stroke, index) => (
        <Path
          key={index}
          d={strokePath(stroke.points)}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </Svg>
  );
}

export function toDrawing(strokes: readonly Stroke[]): Drawing {
  return { width: CANVAS_SIZE, height: CANVAS_SIZE, strokes: [...strokes] };
}
