import rough from 'roughjs/bundled/rough.cjs.js';

export const PALETTE = Object.freeze({
  paper: '#faf6eb', ink: '#282039', gold: '#c49a38', purple: '#593579',
  yellow: '#f3d374', red: '#bd5b50', blue: '#c0d5dd', green: '#b6ccb2',
});
export const ASSET_IDS = Object.freeze([
  'person', 'drawing-hand', 'pen', 'shop', 'factory', 'warehouse', 'box',
  'bulb', 'clock', 'speech-bubble', 'note', 'blank-card', 'arrow', 'check', 'cross', 'cloud',
]);

// Per-call seed state: render order never changes another asset's geometry.
function drawing(seed, palette) {
  const generator = rough.generator();
  let index = 0;
  const shape = (method, args, fill = 'none', stroke = palette.ink, width = 3.4) => {
    const drawable = generator[method](...args, {
      seed: ((seed + index++) % 2147483646) + 1, roughness: .95, bowing: .6,
      stroke, strokeWidth: width, fill: fill === 'none' ? undefined : fill, fillStyle: 'solid',
    });
    return generator.toPaths(drawable).map(p => `<path d="${p.d}" fill="${p.fill || 'none'}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  };
  return {
    path: (data, fill, color, width) => shape('path', [data], fill, color, width),
    circle: (x, y, diameter, fill) => shape('circle', [x, y, diameter], fill),
    rect: (x, y, w, h, fill) => shape('rectangle', [x, y, w, h], fill),
    line: (x1, y1, x2, y2, color, width) => shape('line', [x1, y1, x2, y2], 'none', color, width),
  };
}

// Only plain data enters procedural SVG; never interpolate caller XML/CSS.
function record(value, label, allowed) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${label} must be a plain object`);
  }
  const result = {};
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!allowed.includes(key) || !Object.hasOwn(descriptor, 'value')) {
      throw new TypeError(`Unsupported ${label} field`);
    }
    result[key] = descriptor.value;
  }
  return result;
}

/**
 * Local SVG fragment, 240×240; origin is top-left, except hand/pen where it is
 * the exact nib. Positive x/y run right/down. Hand geometry extends down-right.
 * Props: seed integer 1..2147483646; person pose neutral/talk/think/celebrate;
 * palette is a partial mapping of PALETTE roles to values already in PALETTE.
 * The caller owns placement, labels, clipping, IDs and animation.
 */
export function asset(type, props = {}) {
  if (!ASSET_IDS.includes(type)) throw new TypeError('Unknown asset type');
  props = record(props, 'props', ['seed', 'pose', 'palette']);
  const seed = Object.hasOwn(props, 'seed') ? props.seed : 17;
  if (!Number.isInteger(seed) || seed < 1 || seed > 2147483646) throw new RangeError('Invalid seed');
  if (Object.hasOwn(props, 'pose') && (type !== 'person' || !['neutral', 'talk', 'think', 'celebrate'].includes(props.pose))) {
    throw new TypeError('Invalid person pose');
  }
  const overrides = Object.hasOwn(props, 'palette') ? record(props.palette, 'palette', Object.keys(PALETTE)) : {};
  if (Object.values(overrides).some(color => !Object.values(PALETTE).includes(color))) {
    throw new TypeError('Unapproved palette color');
  }
  const C = { ...PALETTE, ...overrides };
  const { path, rect, circle, line } = drawing(seed, C);
  const anchors = { origin: { x: 0, y: 0 }, center: { x: 120, y: 120 } };
  let markup;
  switch (type) {
    case 'person': {
      const pose = props.pose ?? 'neutral';
      const arms = {
        neutral: 'M 91 116 Q 72 132 65 155 M 149 116 Q 169 132 175 155',
        talk: 'M 91 116 Q 74 134 62 151 M 149 116 Q 174 125 191 94 M 191 94 L 185 82 M 191 94 L 199 84',
        think: 'M 91 116 Q 79 142 112 147 M 149 116 Q 175 111 142 81 M 142 81 L 133 83',
        celebrate: 'M 91 116 Q 68 83 52 59 M 52 59 L 41 54 M 52 59 L 49 46 M 149 116 Q 173 83 189 59 M 189 59 L 202 55 M 189 59 L 193 45',
      };
      markup = path(arms[pose]) + path('M 88 173 Q 88 94 120 92 Q 154 94 152 173 Z', C.blue)
        + line(105, 175, 98, 214) + line(137, 175, 146, 214)
        + line(98, 214, 85, 217) + line(146, 214, 160, 217)
        + circle(120, 59, 61, C.paper) + circle(109, 55, 3, C.ink) + circle(132, 55, 3, C.ink)
        + (pose === 'talk' ? circle(121, 75, 10, C.paper) : path('M 109 72 Q 121 85 133 71'));
      anchors.head = { x: 120, y: 59 };
      anchors.feet = { x: 120, y: 217 };
      break;
    }
    case 'drawing-hand':
    case 'pen': {
      // A non-rough nib prevents seed jitter from moving the physical contact.
      markup = `<path d="M 0 0 L 18 9 L 9 18 Z" fill="${C.ink}" stroke="none"/>`
        + path('M 18 9 L 112 103 L 103 112 L 9 18 Z', C.yellow)
        + line(26, 25, 97, 96, C.gold, 2);
      if (type === 'drawing-hand') {
        markup += path('M 224 181 L 180 143 Q 159 127 150 104 L 130 68 Q 123 57 115 66 L 99 51 Q 87 43 82 55 L 68 43 Q 53 34 48 46 Q 44 55 55 66 L 79 90 L 67 89 Q 49 77 41 87 Q 35 97 54 113 L 93 142 Q 112 154 134 158 L 186 216 Z', C.paper)
          + path('M 55 66 L 91 99 M 82 55 L 111 84 M 115 66 L 130 88 M 79 90 Q 98 100 98 119')
          + path('M 178 146 L 230 187 L 193 228 L 145 183 Z', C.blue)
          + line(184, 168, 207, 186, C.paper, 3);
      }
      anchors.tip = { x: 0, y: 0 };
      anchors.grip = { x: 55, y: 55 };
      anchors.wrist = type === 'drawing-hand' ? { x: 185, y: 188 } : { x: 107, y: 107 };
      break;
    }
    case 'shop':
      markup = rect(39, 94, 162, 116, C.paper)
        + path('M 27 94 L 52 51 L 187 51 L 214 94 Z', C.red)
        + rect(57, 125, 47, 85, C.blue) + rect(131, 124, 49, 40, C.yellow)
        + line(94, 163, 94, 174) + line(156, 124, 156, 163);
      break;
    case 'factory':
      markup = rect(179, 40, 24, 89, C.paper)
        + path('M 28 210 L 28 108 L 76 74 L 76 108 L 124 74 L 124 109 L 211 109 L 211 210 Z', C.green)
        + [47, 104, 161].map(x => rect(x, 144, 30, 36, C.paper)).join('');
      break;
    case 'warehouse':
      markup = path('M 30 208 L 30 99 L 120 43 L 211 99 L 211 208 Z', C.blue)
        + rect(66, 121, 109, 87, C.paper)
        + [140, 158, 176].map(y => line(70, y, 171, y)).join('')
        + line(23, 102, 120, 40) + line(120, 40, 219, 102);
      break;
    case 'box':
      markup = rect(45, 65, 150, 120, C.yellow) + line(120, 65, 120, 185);
      break;
    case 'bulb':
      markup = path('M 97 159 C 95 132 64 122 68 89 C 72 35 168 34 172 89 C 176 122 145 134 143 159 Z', C.yellow)
        + path('M 110 158 L 104 111 L 120 123 L 136 111 L 130 158')
        + rect(97, 159, 46, 25, C.paper) + line(100, 173, 140, 173)
        + path('M 104 188 Q 120 206 138 188')
        + line(120, 20, 120, 32, C.gold) + line(40, 53, 52, 65, C.gold)
        + line(191, 64, 203, 51, C.gold) + line(31, 108, 49, 108, C.gold)
        + line(191, 108, 209, 108, C.gold);
      break;
    case 'clock':
      markup = circle(120, 120, 177, C.paper) + circle(120, 120, 8, C.ink)
        + line(120, 120, 120, 65) + line(120, 120, 157, 138)
        + [[120, 40, 120, 53], [120, 188, 120, 201], [40, 120, 53, 120], [188, 120, 201, 120]]
          .map(points => line(...points, C.gold)).join('');
      break;
    case 'speech-bubble':
      markup = path('M 43 49 Q 23 49 23 72 L 23 146 Q 23 163 43 163 L 70 163 L 58 198 L 108 163 L 196 163 Q 216 163 216 144 L 216 70 Q 216 49 194 49 Z', C.paper);
      anchors.tail = { x: 58, y: 198 };
      break;
    case 'note':
      markup = path('M 44 29 L 197 29 L 197 175 L 163 210 L 44 210 Z', C.yellow)
        + path('M 163 210 L 163 175 L 197 175 Z', C.paper)
        + line(71, 81, 165, 81, C.gold, 2) + line(71, 108, 150, 108, C.gold, 2)
        + line(71, 135, 160, 135, C.gold, 2);
      break;
    case 'blank-card':
      markup = rect(43, 22, 155, 199, C.paper) + line(62, 43, 178, 43, C.gold, 2);
      break;
    case 'arrow':
      markup = path('M 29 125 Q 116 97 207 120 M 180 93 L 207 120 L 179 145', 'none', C.gold, 4);
      anchors.start = { x: 29, y: 125 };
      anchors.end = { x: 207, y: 120 };
      break;
    case 'check':
      markup = path('M 45 121 L 96 170 L 195 68', 'none', C.green, 12);
      break;
    case 'cross':
      markup = line(66, 63, 176, 178, C.red, 10) + line(179, 63, 64, 177, C.red, 10);
      break;
    case 'cloud':
      markup = path('M 60 165 C 17 168 16 108 53 100 C 45 58 108 41 127 77 C 158 42 200 72 193 110 C 231 117 219 168 183 165 Z', C.blue);
      break;
  }
  return { markup, width: 240, height: 240, anchors };
}
