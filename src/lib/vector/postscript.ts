/**
 * PostScript reader for EPS and Illustrator artwork.
 *
 * Opening a real EPS used to be impossible in the studio, which made "open an
 * EPS" mean "open it somewhere else". This module reads the drawing subset that
 * logos, icons, packaging and illustration files actually use: paths, curves,
 * rectangles, arcs, fills, strokes, colours, transforms and simple procedures.
 *
 * It is a reader, not a PostScript interpreter. Bands, images, patterns and
 * shading fall back to the embedded preview so the user still sees the artwork,
 * and the result reports what was converted and what was skipped.
 */

export interface PsShape {
  /** SVG path data in final artwork coordinates. */
  d: string;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
}

export interface PsDocument {
  width: number;
  height: number;
  shapes: PsShape[];
  /** Preview image bytes when the file embeds one. */
  preview: { mime: string; bytes: Uint8Array } | null;
  /** Things the reader consciously dropped. */
  skipped: string[];
  /** Text drawn with show operators, which cannot be converted to curves here. */
  textStrings: string[];
}

interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function multiply(m: Matrix, n: Matrix): Matrix {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

const hex2 = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');

function rgbHex(r: number, g: number, b: number): string {
  return `#${hex2(r * 255)}${hex2(g * 255)}${hex2(b * 255)}`;
}

function cmykHex(c: number, m: number, y: number, k: number): string {
  return rgbHex((1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k));
}

type Token = string | number;

/** Split PostScript into tokens, keeping `(...)` strings and `{ }` bodies intact. */
function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    if (ch === '%') {
      while (i < n && source[i] !== '\n' && source[i] !== '\r') i += 1;
      continue;
    }
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '(') {
      let depth = 1;
      let value = '';
      i += 1;
      while (i < n && depth > 0) {
        const c = source[i];
        if (c === '\\') {
          value += source[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (c === '(') depth += 1;
        if (c === ')') depth -= 1;
        if (depth > 0) value += c;
        i += 1;
      }
      tokens.push(`(${value}`);
      continue;
    }
    if (ch === '{' || ch === '}' || ch === '[' || ch === ']') {
      tokens.push(ch);
      i += 1;
      continue;
    }
    if (ch === '/' || ch === '<') {
      let value = ch;
      i += 1;
      while (i < n && !/[\s(){}[\]<>]/.test(source[i])) {
        value += source[i];
        i += 1;
      }
      if (ch === '<' && source[i] === '<') {
        i += 1;
        continue;
      }
      tokens.push(value);
      continue;
    }
    let word = '';
    while (i < n && !/[\s(){}[\]]/.test(source[i])) {
      word += source[i];
      i += 1;
    }
    const num = Number(word);
    tokens.push(word !== '' && Number.isFinite(num) ? num : word);
  }
  return tokens;
}

interface PathState {
  segments: string[];
  startX: number;
  startY: number;
  x: number;
  y: number;
  hasGeometry: boolean;
}

type Operand = Token | Token[];

/** Parse an EPS or Illustrator file into shapes, size and preview. */
export function parsePostScript(raw: Uint8Array | string): PsDocument {
  const bytes = typeof raw === 'string' ? null : raw;
  const source = typeof raw === 'string' ? raw : new TextDecoder('latin1').decode(raw);
  const preview = bytes ? extractPreview(bytes) : null;

  // Bounding box decides the artwork size; HiRes wins when both exist.
  const box = (() => {
    const hiRes = source.match(/%%HiResBoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/);
    const plain = source.match(/%%BoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/);
    const hit = hiRes ?? plain;
    if (!hit) return null;
    const [x0, y0, x1, y1] = hit.slice(1, 5).map(Number);
    if (![x0, y0, x1, y1].every(Number.isFinite) || x1 <= x0 || y1 <= y0) return null;
    return { x0, y0, width: x1 - x0, height: y1 - y0 };
  })();

  const tokens = tokenize(source);
  const shapes: PsShape[] = [];
  const skipped = new Set<string>();
  const textStrings: string[] = [];

  let width = box?.width ?? 0;
  let height = box?.height ?? 0;
  const originX = box?.x0 ?? 0;
  const originY = box?.y0 ?? 0;

  let ctm = IDENTITY;
  const stack: Matrix[] = [];
  let fill: string | null = '#000000';
  let stroke: string | null = null;
  let strokeWidth = 1;

  let path: PathState = { segments: [], startX: 0, startY: 0, x: 0, y: 0, hasGeometry: false };

  const procedures = new Map<string, Token[]>();
  const operandStack: Operand[] = [];

  const toSvg = (x: number, y: number): [number, number] => {
    const px = ctm.a * x + ctm.c * y + ctm.e;
    const py = ctm.b * x + ctm.d * y + ctm.f;
    // Artwork coordinates are absolute here; the y flip happens once at the end.
    return [px - originX, py - originY];
  };

  const flipY = (y: number) => (height || 1) - y;
  const fmt = (value: number) => Number(value.toFixed(2)).toString();

  const moveTo = (x: number, y: number) => {
    const [px, py] = toSvg(x, y);
    path.segments.push(`M${fmt(px)} ${fmt(flipY(py))}`);
    path.startX = px;
    path.startY = py;
    path.x = px;
    path.y = py;
    path.hasGeometry = true;
  };
  const lineTo = (x: number, y: number) => {
    const [px, py] = toSvg(x, y);
    if (!path.hasGeometry) return moveTo(x, y);
    path.segments.push(`L${fmt(px)} ${fmt(flipY(py))}`);
    path.x = px;
    path.y = py;
  };
  const curveTo = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
    const [ax, ay] = toSvg(x1, y1);
    const [bx, by] = toSvg(x2, y2);
    const [cx, cy] = toSvg(x3, y3);
    if (!path.hasGeometry) return moveTo(x1, y1);
    path.segments.push(
      `C${fmt(ax)} ${fmt(flipY(ay))} ${fmt(bx)} ${fmt(flipY(by))} ${fmt(cx)} ${fmt(flipY(cy))}`,
    );
    path.x = cx;
    path.y = cy;
  };

  const closePath = () => {
    if (path.hasGeometry) path.segments.push('Z');
  };

  const resetPath = () => {
    path = { segments: [], startX: 0, startY: 0, x: 0, y: 0, hasGeometry: false };
  };

  const paint = (paintFill: boolean, paintStroke: boolean) => {
    if (path.segments.length) {
      const scaledStroke = Math.max(0.2, strokeWidth * Math.max(Math.abs(ctm.a), Math.abs(ctm.d)) || strokeWidth);
      shapes.push({
        d: path.segments.join(''),
        fill: paintFill ? fill : null,
        stroke: paintStroke ? (stroke ?? fill ?? '#000000') : null,
        strokeWidth: Number(scaledStroke.toFixed(2)),
      });
    }
    resetPath();
  };

  const arcTo = (cx: number, cy: number, rx: number, ry: number, from: number, to: number, clockwise: boolean) => {
    // Sample the arc; 24 steps per revolution is smooth at every realistic size.
    const sweep = clockwise ? from - to : to - from;
    const steps = Math.max(6, Math.ceil((Math.abs(sweep) / (Math.PI * 2)) * 48));
    for (let step = 0; step <= steps; step += 1) {
      const angle = from + (sweep * step) / steps;
      const x = cx + rx * Math.cos(angle);
      const y = cy + ry * Math.sin(angle);
      if (step === 0 && !path.hasGeometry) moveTo(x, y);
      else lineTo(x, y);
    }
  };

  const num = (index: number): number => {
    const value = operandStack[operandStack.length - index];
    return typeof value === 'number' ? value : 0;
  };

  let depth = 0;
  const run = (list: Token[]) => {
    if (depth > 8) return;
    depth += 1;
    try {
      for (let i = 0; i < list.length; i += 1) {
        const token = list[i];
        if (token === '{') {
          // Capture the procedure body verbatim.
          let level = 1;
          const body: Token[] = [];
          i += 1;
          while (i < list.length && level > 0) {
            if (list[i] === '{') level += 1;
            if (list[i] === '}') level -= 1;
            if (level > 0) body.push(list[i]);
            i += 1;
          }
          i -= 1;
          operandStack.push(body);
          continue;
        }
        if (token === '[' || token === ']' || token === '>') continue;
        if (typeof token === 'number' || (typeof token === 'string' && (token.startsWith('/') || token.startsWith('(')))) {
          operandStack.push(token);
          if (operandStack.length > 64) operandStack.splice(0, operandStack.length - 64);
          continue;
        }
        if (typeof token !== 'string') continue;

        switch (token) {
          case 'def': {
            const body = operandStack.pop();
            const name = operandStack.pop();
            if (typeof name === 'string' && name.startsWith('/')) {
              if (Array.isArray(body)) procedures.set(name.slice(1), body);
              else procedures.delete(name.slice(1));
            }
            break;
          }
          case 'bind':
          case 'showpage':
          case 'erasepage':
            break;
          case 'gsave':
            stack.push(ctm);
            break;
          case 'grestore':
            ctm = stack.pop() ?? IDENTITY;
            break;
          case 'translate': {
            const ty = num(1);
            const tx = num(2);
            ctm = multiply(ctm, { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty });
            operandStack.length = Math.max(0, operandStack.length - 2);
            break;
          }
          case 'scale': {
            const sy = num(1);
            const sx = num(2);
            ctm = multiply(ctm, { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 });
            operandStack.length = Math.max(0, operandStack.length - 2);
            break;
          }
          case 'rotate': {
            const angle = (num(1) * Math.PI) / 180;
            ctm = multiply(ctm, {
              a: Math.cos(angle),
              b: Math.sin(angle),
              c: -Math.sin(angle),
              d: Math.cos(angle),
              e: 0,
              f: 0,
            });
            operandStack.pop();
            break;
          }
          case 'concat': {
            const f = num(1);
            const e = num(2);
            const d = num(3);
            const c = num(4);
            const b = num(5);
            const a = num(6);
            ctm = multiply(ctm, { a, b, c, d, e, f });
            operandStack.length = Math.max(0, operandStack.length - 6);
            break;
          }
          case 'newpath':
            resetPath();
            break;
          case 'moveto':
            moveTo(num(2), num(1));
            operandStack.length = Math.max(0, operandStack.length - 2);
            break;
          case 'rmoveto':
            moveTo(path.x + num(2), path.y + num(1));
            operandStack.length = Math.max(0, operandStack.length - 2);
            break;
          case 'lineto':
            lineTo(num(2), num(1));
            operandStack.length = Math.max(0, operandStack.length - 2);
            break;
          case 'rlineto':
            lineTo(path.x + num(2), path.y + num(1));
            operandStack.length = Math.max(0, operandStack.length - 2);
            break;
          case 'curveto':
            curveTo(num(6), num(5), num(4), num(3), num(2), num(1));
            operandStack.length = Math.max(0, operandStack.length - 6);
            break;
          case 'rcurveto':
            curveTo(
              path.x + num(6),
              path.y + num(5),
              path.x + num(4),
              path.y + num(3),
              path.x + num(2),
              path.y + num(1),
            );
            operandStack.length = Math.max(0, operandStack.length - 6);
            break;
          case 'closepath':
            closePath();
            break;
          case 'rectfill':
          case 'rectstroke':
          case 'rectclip': {
            const h = num(1);
            const w = num(2);
            const y = num(3);
            const x = num(4);
            resetPath();
            moveTo(x, y);
            lineTo(x + w, y);
            lineTo(x + w, y + h);
            lineTo(x, y + h);
            closePath();
            operandStack.length = Math.max(0, operandStack.length - 4);
            if (token === 'rectfill') paint(true, false);
            else if (token === 'rectstroke') paint(false, true);
            else resetPath();
            break;
          }
          case 'arc':
          case 'arcn': {
            const end = (num(1) * Math.PI) / 180;
            const start = (num(2) * Math.PI) / 180;
            const r = num(3);
            const cy = num(4);
            const cx = num(5);
            arcTo(cx, cy, r, r, start, end, token === 'arcn');
            operandStack.length = Math.max(0, operandStack.length - 5);
            break;
          }
          case 'setrgbcolor':
            fill = rgbHex(num(3), num(2), num(1));
            operandStack.length = Math.max(0, operandStack.length - 3);
            break;
          case 'setgray':
            fill = rgbHex(num(1), num(1), num(1));
            operandStack.pop();
            break;
          case 'setcmykcolor':
            fill = cmykHex(num(4), num(3), num(2), num(1));
            operandStack.length = Math.max(0, operandStack.length - 4);
            break;
          case 'setlinewidth':
            strokeWidth = Math.max(0.1, num(1));
            operandStack.pop();
            break;
          case 'fill':
          case 'eofill':
            paint(true, false);
            break;
          case 'stroke':
            paint(false, true);
            break;
          case 'fillstroke':
            paint(true, true);
            break;
          case 'clip':
          case 'eoclip':
            resetPath();
            break;
          case 'show':
          case 'ashow':
          case 'widthshow': {
            const text = operandStack
              .filter((value): value is string => typeof value === 'string' && value.startsWith('('))
              .pop();
            if (text) textStrings.push(text.slice(1));
            operandStack.length = 0;
            break;
          }
          case 'image':
          case 'colorimage':
          case 'imagemask':
            skipped.add('embedded raster image');
            operandStack.length = 0;
            break;
          case 'shfill':
            skipped.add('gradient shading');
            operandStack.length = 0;
            break;
          case 'setdash':
          case 'setlinecap':
          case 'setlinejoin':
          case 'setmiterlimit':
            operandStack.length = Math.max(0, operandStack.length - 2);
            break;
          default: {
            // A user procedure call: run its body. Anything else is an operator
            // this reader does not model, so drop its operands and carry on.
            const proc = procedures.get(token);
            if (proc) run(proc);
            else operandStack.length = 0;
            break;
          }
        }
      }
    } finally {
      depth -= 1;
    }
  };

  run(tokens);

  // A file without a bounding box still has shape extents: derive a canvas.
  if (!width || !height) {
    let maxX = 0;
    let maxY = 0;
    for (const shape of shapes) {
      const numbers = shape.d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      for (let i = 0; i + 1 < numbers.length; i += 2) {
        maxX = Math.max(maxX, numbers[i]);
        maxY = Math.max(maxY, numbers[i + 1]);
      }
    }
    width = Math.max(1, Math.ceil(maxX));
    height = Math.max(1, Math.ceil(maxY));
  }

  if (!shapes.length) skipped.add('no supported vector operators');
  if (textStrings.length) skipped.add(`${textStrings.length} text run${textStrings.length === 1 ? '' : 's'} (convert to outlines)`);

  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    shapes,
    preview,
    skipped: Array.from(skipped),
    textStrings: textStrings.slice(0, 20),
  };
}

/** Find a JPEG or PNG preview inside the binary payload. */
function extractPreview(bytes: Uint8Array): { mime: string; bytes: Uint8Array } | null {
  // PNG signature
  for (let i = 0; i + 8 < bytes.length; i += 1) {
    if (
      bytes[i] === 0x89 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x4e && bytes[i + 3] === 0x47
    ) {
      for (let j = bytes.length - 8; j > i; j -= 1) {
        if (bytes[j] === 0x49 && bytes[j + 1] === 0x45 && bytes[j + 2] === 0x4e && bytes[j + 3] === 0x44) {
          return { mime: 'image/png', bytes: bytes.slice(i, j + 8) };
        }
      }
    }
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
      for (let j = bytes.length - 2; j > i + 2; j -= 1) {
        if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
          return { mime: 'image/jpeg', bytes: bytes.slice(i, j + 2) };
        }
      }
    }
  }
  return null;
}

/** Convert a parsed PostScript file into an editable SVG document. */
export function postScriptToSvg(doc: PsDocument): string {
  const paths = doc.shapes
    .map((shape) => {
      const attrs = [
        `d="${shape.d}"`,
        `fill="${shape.fill ?? 'none'}"`,
        shape.stroke ? `stroke="${shape.stroke}"` : '',
        shape.stroke ? `stroke-width="${shape.strokeWidth}"` : '',
        shape.stroke ? 'stroke-linecap="round" stroke-linejoin="round"' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<path ${attrs} />`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}">${paths}</svg>`;
}
