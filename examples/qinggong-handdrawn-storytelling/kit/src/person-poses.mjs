// SPDX-License-Identifier: Apache-2.0
// Original reserve people, palette-compatible with the hand-drawn asset kit.
import rough from 'roughjs/bundled/rough.cjs.js';

export const PERSON_POSES = Object.freeze([
  'neutral', 'happy', 'laugh', 'sad', 'cry', 'think',
  'confused', 'wave', 'point', 'explain', 'worried', 'celebrate',
]);
const C = Object.freeze({paper:'#faf6eb', ink:'#282039', blue:'#c0d5dd', green:'#b6ccb2'});

// All geometry is authored here, never supplied by the caller. Head tilt and
// eyes/brows change together; each pose has its own arms AND stance.
const POSES = {
  neutral: {
    tilt:0,
    arms:'M 91 116 Q 74 133 68 157 M 149 116 Q 165 134 173 157',
    legs:'M 105 175 L 100 214 L 87 217 M 137 175 L 143 214 L 157 217',
    hands:'M 67 157 l -2 7 M 173 157 l 2 7',
    eyes:[[109,55],[132,55]], brows:'M 103 46 L 113 45 M 127 45 L 137 46',
    mouth:'M 111 73 Q 121 76 131 73',
    left:[68,157],right:[173,157], feet:[122,217],
  },
  happy: {
    tilt:-4,
    arms:'M 91 116 Q 73 145 53 127 M 149 116 Q 170 141 187 123',
    legs:'M 105 175 L 93 213 L 79 215 M 137 175 L 154 210 L 168 208',
    hands:'M 53 127 l -8 -4 M 53 127 l -3 -10 M 187 123 l 9 -4 M 187 123 l 2 -11',
    eyesPath:'M 104 57 Q 109 48 114 57 M 127 57 Q 132 48 137 57',
    brows:'M 102 45 Q 109 40 116 44 M 125 44 Q 132 40 139 45',
    mouth:'M 108 71 Q 121 89 135 70',
    left:[53,127],right:[187,123],feet:[124,215],
  },
  laugh: {
    tilt:-10,
    arms:'M 91 117 Q 68 143 94 151 M 149 116 Q 172 118 166 91',
    legs:'M 104 175 L 94 198 L 106 214 L 92 218 M 137 175 L 151 202 L 147 215 L 161 216',
    hands:'M 94 151 Q 110 153 126 145 M 123 145 l 8 -1 M 166 91 l -6 -8 M 166 91 l 1 -11',
    eyesPath:'M 103 52 L 113 57 L 104 61 M 138 52 L 128 57 L 137 61',
    brows:'M 100 45 Q 108 40 115 44 M 125 44 Q 133 39 141 45',
    mouth:'M 108 70 Q 121 75 135 68 Q 132 90 119 86 Q 111 83 108 70 Z', mouthFill:true,
    extra:'M 78 50 l -7 -5 M 77 65 l -9 1 M 160 40 l 6 -5',
    left:[126,145],right:[166,91],feet:[127,218],
  },
  sad: {
    tilt:8,
    arms:'M 92 119 Q 80 144 85 168 M 148 119 Q 160 145 155 168',
    legs:'M 107 175 L 111 213 L 97 216 M 135 175 L 131 213 L 145 216',
    hands:'M 85 168 l 2 8 M 155 168 l -2 8',
    eyesPath:'M 104 59 Q 109 62 114 59 M 127 59 Q 132 62 137 59',
    brows:'M 102 50 Q 110 49 115 44 M 126 44 Q 132 49 139 50',
    mouth:'M 111 78 Q 121 69 132 78',
    left:[85,168],right:[155,168],feet:[121,216],
  },
  cry: {
    tilt:4,
    arms:'M 92 120 Q 63 124 80 96 M 148 120 Q 177 127 161 96',
    legs:'M 107 175 L 115 196 L 104 214 L 90 214 M 134 175 L 127 196 L 138 214 L 152 214',
    hands:'M 80 96 L 90 81 l 4 -2 M 161 96 L 151 81 l -4 -2',
    eyesPath:'M 102 58 Q 109 52 116 58 M 126 58 Q 133 52 140 58',
    brows:'M 102 48 Q 110 48 116 42 M 126 42 Q 133 48 140 48',
    mouth:'M 114 78 Q 121 69 128 78 Q 122 76 114 78 Z',
    tears:['M 107 62 Q 104 69 104 76 Q 109 82 112 75 L 110 62 Z','M 132 62 L 130 76 Q 135 82 139 75 Q 137 67 135 62 Z'],
    left:[90,81],right:[151,81],feet:[121,214],
  },
  think: {
    tilt:-6,
    arms:'M 91 117 Q 74 146 99 148 M 149 116 Q 173 129 156 105',
    legs:'M 106 175 L 111 212 L 97 216 M 136 175 L 129 199 L 143 215 L 158 215',
    hands:'M 85 138 Q 85 150 99 148 L 138 143 M 156 105 L 139 82 L 130 81 M 139 82 l 3 -9',
    eyes:[[111,55],[134,53]],brows:'M 103 45 L 115 44 M 126 44 Q 133 39 139 42',
    mouth:'M 117 74 L 128 72',
    left:[138,143],right:[139,82],feet:[127,216],
  },
  confused: {
    tilt:-11,
    arms:'M 91 118 Q 67 144 48 107 M 149 117 Q 175 141 191 106',
    legs:'M 105 175 L 99 211 L 83 214 M 137 175 L 150 212 L 165 210',
    hands:'M 48 107 L 36 106 M 48 107 L 43 99 M 191 106 L 204 104 M 191 106 L 196 98',
    eyes:[[110,58],[133,54]],brows:'M 101 49 L 114 51 M 126 42 Q 134 35 142 42',
    mouth:'M 111 77 Q 117 71 123 76 Q 128 80 135 74',
    left:[48,107],right:[191,106],feet:[124,214],
  },
  wave: {
    tilt:-3,
    arms:'M 91 116 Q 71 129 65 151 M 149 116 Q 181 110 180 74',
    legs:'M 105 175 L 99 214 L 85 218 M 137 175 L 145 209 L 160 213',
    hands:'M 65 151 l -5 8 M 180 74 L 170 66 L 166 56 M 180 74 L 175 51 M 180 74 L 184 48 M 180 74 L 192 55 M 199 72 Q 202 87 195 96',
    eyes:[[109,54],[132,55]],brows:'M 102 44 Q 109 41 115 45 M 126 45 Q 132 41 139 45',
    mouth:'M 108 70 Q 120 86 134 71',
    left:[65,151],right:[180,74],feet:[123,218],
  },
  point: {
    tilt:3,
    arms:'M 91 116 Q 68 142 95 145 M 149 116 Q 170 103 192 100',
    legs:'M 105 175 L 98 211 L 83 215 M 137 175 L 154 210 L 170 210',
    hands:'M 95 145 l 10 -6 M 192 100 L 213 95 M 192 100 L 199 105 L 208 104',
    eyes:[[112,55],[135,55]],brows:'M 104 45 L 116 43 M 128 43 L 139 45',
    mouth:'M 117 75 Q 128 80 135 71',
    left:[95,145],right:[213,95],feet:[126,215],
  },
  explain: {
    tilt:2,
    arms:'M 91 116 Q 71 138 48 138 M 149 116 Q 173 128 190 104',
    legs:'M 105 175 L 103 213 L 87 215 M 137 175 L 144 215 L 159 217',
    hands:'M 48 138 L 36 133 M 48 138 L 38 142 M 190 104 L 187 93 M 190 104 L 198 98 M 190 104 L 202 104',
    eyes:[[109,55],[132,55]],brows:'M 102 45 Q 109 39 116 44 M 125 44 Q 132 39 139 45',
    mouth:'M 115 72 Q 121 68 127 73 Q 128 82 121 81 Q 115 80 115 72 Z',
    left:[48,138],right:[190,104],feet:[123,217],
  },
  worried: {
    tilt:6,
    arms:'M 91 117 Q 74 144 100 152 M 149 117 Q 165 142 139 152',
    legs:'M 107 175 L 115 211 L 102 216 M 134 175 L 128 211 L 143 216',
    hands:'M 86 139 Q 87 148 100 152 L 117 144 Q 127 140 132 148 L 139 152 Q 154 148 154 139 M 114 146 Q 112 154 126 157 L 135 151 M 124 146 l 4 8',
    eyes:[[108,58],[134,58]],brows:'M 100 50 L 115 44 M 126 44 L 142 50',
    mouth:'M 111 78 Q 115 72 120 75 Q 125 79 131 73',
    extra:'M 154 58 Q 149 65 155 67 Q 160 65 154 58 Z',
    left:[117,148],right:[132,150],feet:[122,216],
  },
  celebrate: {
    tilt:-5,
    arms:'M 91 116 Q 69 84 53 57 M 149 116 Q 174 83 189 54',
    legs:'M 105 175 L 84 204 L 67 199 M 137 175 L 159 201 L 177 195',
    hands:'M 53 57 L 43 52 L 44 43 L 50 45 L 54 39 L 62 44 L 60 51 M 189 54 L 181 47 L 184 38 L 191 42 L 197 39 L 202 47 L 198 54',
    eyesPath:'M 103 56 Q 109 46 115 56 M 126 56 Q 132 46 138 56',
    brows:'M 101 42 L 114 39 M 127 39 L 140 42',
    mouth:'M 107 68 Q 121 74 136 68 Q 122 92 107 68 Z',
    extra:'M 32 34 l -6 -8 M 65 26 l 3 -9 M 207 28 l 7 -8 M 214 62 l 10 -1',
    left:[53,49],right:[191,46],feet:[122,204],
  },
};

function drawing(seed) {
  const generator = rough.generator();
  let index = 0;
  const shape = (method, args, fill = 'none', detail = false) => {
    const drawable = generator[method](...args, {
      seed: ((seed + index++) % 2147483646) + 1,
      roughness: detail ? 0.45 : 0.95, bowing: 0.6,
      stroke: C.ink, strokeWidth: detail ? 2 : 3.4,
      fill: fill === 'none' ? undefined : fill, fillStyle: 'solid',
      disableMultiStroke: detail,
    });
    return generator.toPaths(drawable).map(p => `<path d="${p.d}" fill="${p.fill || 'none'}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  };
  return {
    path:(d,fill,detail) => d ? shape('path',[d],fill,detail) : '',
    circle:(x,y,d,fill,detail) => shape('circle',[x,y,d],fill,detail),
  };
}

/** Return an SVG fragment with a 240×240 local coordinate space.
 * Options: seed (integer 1..2147483646), shirt ('blue'|'green').
 * Labels, surrounding SVG, placement and animations belong to the caller.
 */
export function personAsset(pose, options = {}) {
  if (!PERSON_POSES.includes(pose)) throw new TypeError('Unknown person pose');
  if (!options || Object.getPrototypeOf(options) !== Object.prototype) {
    throw new TypeError('Options must be a plain data object');
  }
  const props = {};
  for (const key of Reflect.ownKeys(options)) {
    const descriptor = Object.getOwnPropertyDescriptor(options,key);
    if (!['seed','shirt'].includes(key) || !Object.hasOwn(descriptor,'value')) {
      throw new TypeError('Unsupported option field');
    }
    props[key] = descriptor.value;
  }
  const seed = Object.hasOwn(props,'seed') ? props.seed : 17;
  const shirt = Object.hasOwn(props,'shirt') ? props.shirt : 'blue';
  if (!Number.isInteger(seed) || seed < 1 || seed > 2147483646) throw new RangeError('Invalid seed');
  if (!['blue','green'].includes(shirt)) throw new TypeError('Invalid shirt enum');
  const d = POSES[pose];
  const {path,circle} = drawing(seed);
  const limbs = path(d.arms) + path(d.legs);
  const torso = path('M 88 173 Q 88 94 120 92 Q 154 94 152 173 Z',C[shirt]);
  let face = circle(120,59,61,C.paper);
  face += path(d.brows,'none',true);
  face += d.eyes ? d.eyes.map(([x,y]) => circle(x,y,3,C.ink,true)).join('') : path(d.eyesPath,'none',true);
  face += path(d.mouth,d.mouthFill ? C.ink : 'none',true);
  for (const tear of d.tears || []) face += path(tear,C.blue,true);
  const markup = `<g data-part="limbs">${limbs}</g>` + torso
    + `<g data-part="face" transform="rotate(${d.tilt} 120 59)">${face}</g>`
    + `<g data-part="hands">${path(d.hands)}</g>` + path(d.extra,'none',true);
  const point = ([x,y]) => ({x,y});
  return {markup,width:240,height:240,anchors:{
    origin:{x:0,y:0},center:{x:120,y:120},head:{x:120,y:59},
    feet:point(d.feet),leftHand:point(d.left),rightHand:point(d.right),
  }};
}
