/**
 * Monoline display type, stored as geometry.
 *
 * Generated artwork must never depend on a live font: marketplaces reject live
 * text in EPS, and a missing font silently reflows a design on the customer's
 * machine. Every letter here is a set of straight polylines on a 5 x 7 grid, so
 * headlines can be emitted as ordinary editable paths with consistent stroke
 * weight, spacing and alignment.
 */

type Polyline = number[][];
type Glyph = Polyline[];

const GLYPHS: Record<string, Glyph> = {
  A: [
    [[0, 7], [0, 2.5], [2.5, 0], [5, 2.5], [5, 7]],
    [[0, 4.4], [5, 4.4]],
  ],
  B: [
    [[0, 0], [0, 7]],
    [[0, 0], [3.2, 0], [4.6, 1.1], [4.6, 2.6], [3.2, 3.5], [0, 3.5]],
    [[3.2, 3.5], [4.8, 4.5], [4.8, 6], [3.4, 7], [0, 7]],
  ],
  C: [
    [[5, 0.8], [3.6, 0], [1.4, 0], [0, 1.6], [0, 5.4], [1.4, 7], [3.6, 7], [5, 6.2]],
  ],
  D: [
    [[0, 0], [0, 7], [2.6, 7], [5, 4.6], [5, 2.4], [2.6, 0], [0, 0]],
  ],
  E: [
    [[5, 0], [0, 0], [0, 7], [5, 7]],
    [[0, 3.4], [3.8, 3.4]],
  ],
  F: [
    [[5, 0], [0, 0], [0, 7]],
    [[0, 3.4], [3.6, 3.4]],
  ],
  G: [
    [[5, 0.8], [3.6, 0], [1.4, 0], [0, 1.6], [0, 5.4], [1.4, 7], [3.6, 7], [5, 5.4], [5, 3.8], [2.8, 3.8]],
  ],
  H: [
    [[0, 0], [0, 7]],
    [[5, 0], [5, 7]],
    [[0, 3.5], [5, 3.5]],
  ],
  I: [
    [[2.5, 0], [2.5, 7]],
    [[1, 0], [4, 0]],
    [[1, 7], [4, 7]],
  ],
  J: [
    [[4.6, 0], [4.6, 5.2], [3.6, 7], [1, 7], [0, 5.6]],
  ],
  K: [
    [[0, 0], [0, 7]],
    [[4.8, 0], [0.2, 3.8]],
    [[1.8, 2.6], [5, 7]],
  ],
  L: [
    [[0, 0], [0, 7], [5, 7]],
  ],
  M: [
    [[0, 7], [0, 0], [2.5, 4], [5, 0], [5, 7]],
  ],
  N: [
    [[0, 7], [0, 0], [5, 7], [5, 0]],
  ],
  O: [
    [[1.6, 0], [3.4, 0], [5, 1.8], [5, 5.2], [3.4, 7], [1.6, 7], [0, 5.2], [0, 1.8], [1.6, 0]],
  ],
  P: [
    [[0, 7], [0, 0], [3.4, 0], [5, 1.4], [5, 3], [3.4, 4.4], [0, 4.4]],
  ],
  Q: [
    [[1.6, 0], [3.4, 0], [5, 1.8], [5, 5.2], [3.6, 6.8], [1.4, 6.8], [0, 5.2], [0, 1.8], [1.6, 0]],
    [[3.2, 5.4], [5, 7.4]],
  ],
  R: [
    [[0, 7], [0, 0], [3.4, 0], [5, 1.4], [5, 3], [3.4, 4.4], [0, 4.4]],
    [[2.6, 4.4], [5, 7]],
  ],
  S: [
    [[5, 1], [3.6, 0], [1.4, 0], [0, 1.3], [0, 2.6], [1.5, 3.4], [3.5, 3.6], [5, 4.5], [5, 6], [3.6, 7], [1.2, 7], [0, 6]],
  ],
  T: [
    [[0, 0], [5, 0]],
    [[2.5, 0], [2.5, 7]],
  ],
  U: [
    [[0, 0], [0, 5.2], [1.4, 7], [3.6, 7], [5, 5.2], [5, 0]],
  ],
  V: [
    [[0, 0], [2.5, 7], [5, 0]],
  ],
  W: [
    [[0, 0], [1.2, 7], [2.5, 2.4], [3.8, 7], [5, 0]],
  ],
  X: [
    [[0, 0], [5, 7]],
    [[5, 0], [0, 7]],
  ],
  Y: [
    [[0, 0], [2.5, 3.6], [5, 0]],
    [[2.5, 3.6], [2.5, 7]],
  ],
  Z: [
    [[0, 0], [5, 0], [0, 7], [5, 7]],
  ],
  '0': [
    [[1.6, 0], [3.4, 0], [5, 1.8], [5, 5.2], [3.4, 7], [1.6, 7], [0, 5.2], [0, 1.8], [1.6, 0]],
  ],
  '1': [
    [[1.2, 1.4], [2.8, 0], [2.8, 7]],
    [[1, 7], [4.6, 7]],
  ],
  '2': [
    [[0, 1.4], [1.4, 0], [3.4, 0], [5, 1.4], [5, 3], [0, 7], [5, 7]],
  ],
  '3': [
    [[0, 0.8], [1.4, 0], [3.6, 0], [5, 1.4], [5, 2.6], [3.4, 3.4], [1.4, 3.4]],
    [[3.4, 3.4], [5, 4.2], [5, 5.8], [3.6, 7], [1.2, 7], [0, 6.2]],
  ],
  '4': [
    [[4, 7], [4, 0], [0, 4.8], [5, 4.8]],
  ],
  '5': [
    [[5, 0], [0.8, 0], [0.6, 3.2], [2.4, 2.8], [4.2, 3.2], [5, 4.6], [4.8, 6.2], [3.2, 7], [1, 7], [0, 6]],
  ],
  '6': [
    [[4.6, 0.6], [3.2, 0], [1.4, 0.6], [0, 2.6], [0, 5.6], [1.4, 7], [3.6, 7], [5, 5.6], [5, 4.2], [3.6, 3], [1.4, 3], [0, 4.2]],
  ],
  '7': [
    [[0, 0], [5, 0], [2, 7]],
  ],
  '8': [
    [[1.6, 3.4], [0, 2.4], [0, 1], [1.6, 0], [3.4, 0], [5, 1], [5, 2.4], [3.4, 3.4], [1.6, 3.4], [0, 4.4], [0, 6], [1.4, 7], [3.6, 7], [5, 6], [5, 4.4], [3.4, 3.4], [1.6, 3.4]],
  ],
  '9': [
    [[5, 4], [3.6, 3], [1.4, 3], [0, 4.4], [0, 5.8], [1.4, 7], [3.4, 7], [5, 6], [5, 2.6], [4.6, 1], [3.2, 0], [1.2, 0], [0, 0.8]],
  ],
  '&': [
    [[5, 7], [1.6, 2.6], [1.6, 1.2], [2.6, 0], [3.6, 1], [3.6, 2], [0, 4.4], [0, 5.8], [1.4, 7], [3, 7], [5, 5]],
  ],
  '-': [[[1, 3.6], [4, 3.6]]],
  '.': [
    [[2.3, 6.4], [2.7, 6.4], [2.7, 6.8], [2.3, 6.8], [2.3, 6.4]],
  ],
  "'": [[[2.5, 0], [2.1, 2]]],
};

export interface GlyphRun {
  /** Stroke path in the caller's coordinate space. */
  d: string;
  width: number;
  height: number;
}

/**
 * Lays out a line of text as one stroke path.
 * `capHeight` is the height of a capital letter; the run is left aligned at
 * (x, y) where y is the baseline.
 */
export function textPath(
  text: string,
  x: number,
  y: number,
  capHeight: number,
  letterSpacing = 0.22,
): GlyphRun {
  const unit = capHeight / 7;
  const advance = 5 * unit + letterSpacing * capHeight;
  let cursor = 0;
  const parts: string[] = [];
  for (const raw of text.toUpperCase()) {
    if (raw === ' ') {
      cursor += advance * 0.7;
      continue;
    }
    const glyph = GLYPHS[raw];
    if (!glyph) {
      cursor += advance;
      continue;
    }
    for (const line of glyph) {
      const points = line.map(([gx, gy]) => [x + cursor + gx * unit, y - (7 - gy) * unit]);
      parts.push(
        `M${points.map(([px, py]) => `${round(px)} ${round(py)}`).join('L')}`,
      );
    }
    cursor += advance;
  }
  return {
    d: parts.join(''),
    width: Math.max(0, cursor - letterSpacing * capHeight),
    height: capHeight,
  };
}

/** Width of a run without building the path, used for centred lockups. */
export function textWidth(text: string, capHeight: number, letterSpacing = 0.22): number {
  const unit = capHeight / 7;
  const advance = 5 * unit + letterSpacing * capHeight;
  let total = 0;
  for (const raw of text.toUpperCase()) total += raw === ' ' ? advance * 0.7 : advance;
  return Math.max(0, total - letterSpacing * capHeight);
}

const round = (value: number) => Math.round(value * 100) / 100;
