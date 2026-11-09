import { validateStory, localAsset } from './schema.mjs';

export const INTRO_DURATION = 7.72;
export const OUTRO_DURATION = 8;
const C = { ink: '#282039', gold: '#c49a38', yellow: '#f3d374' };
const time = value => Math.round(value * 1e6) / 1e6;

// Solid, pen-drawn ribbon using only the public path/color contract. The
// compiler's default 5px rounded stroke overlaps these <=4px-spaced passes.
function ribbon(width, height) {
  const rows = Math.ceil((height - 5) / 4);
  return Array.from({ length: rows + 1 }, (_, i) => {
    const y = time(2.5 + i * (height - 5) / rows);
    const start = i % 2 ? width - 2.5 : 2.5;
    const end = i % 2 ? 2.5 : width - 2.5;
    return `${i ? 'L' : 'M'} ${start} ${y} L ${end} ${y}`;
  }).join(' ');
}
const ring = r => `M ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0`;

/**
 * Add neutral 1440×1080 teaching bookends to a plain body storyboard.
 * No input mutation; body actions/chapters and explicit audio shift by 7.72s.
 * Labels remain data: the compiler outlines every glyph, never live SVG text.
 * concept/application: paired local assets/... image paths, never auto-selected.
 * contributor/reference: optional short factual strings supplied by the caller.
 */
export function withBookends(story, { topic = story?.title, concept, application, contributor, reference } = {}) {
  validateStory(story);
  if (typeof topic !== 'string' || !topic.trim() || Array.from(topic).length > 24) {
    throw new TypeError('topic must contain 1–24 characters');
  }
  if ((concept !== undefined) !== (application !== undefined)) {
    throw new TypeError('Cards are a pair: provide both concept and application');
  }
  if (concept !== undefined) { localAsset(concept); localAsset(application); }
  for (const [name, text, limit] of [['contributor', contributor, 20], ['reference', reference, 60]]) {
    if (text !== undefined && (typeof text !== 'string' || !text.trim() || Array.from(text).length > limit)) {
      throw new TypeError(`${name} must contain 1–${limit} characters`);
    }
  }
  const result = structuredClone(story);
  const outro = time(INTRO_DURATION + story.duration);
  result.duration = time(outro + OUTRO_DURATION);
  const ids = new Set(result.objects.map(o => o.id));
  let prefix = 'sb_';
  while ([...ids].some(id => id.startsWith(prefix))) prefix += '_';
  const id = key => prefix + key;
  const added = [];
  const object = (key, fields) => { const o = { id: id(key), ...fields }; added.push(o); return o; };
  const image = (key, src, x, y, width, height) => object(key, { type: 'image', src, x, y, width, height });
  const label = (key, text, x, y, size, color = C.ink) => object(key, { type: 'label', text, x, y, size, color });
  const path = (key, d, x, y, color = C.gold) => object(key, { type: 'path', d, x, y, color });
  const actions = [];
  const action = (type, key, at, duration, extra = {}) => actions.push({ type, target: id(key), at: time(at), duration, ...extra });
  const topicSize = max => Math.min(max, 550 / (Array.from(topic).length * 1.03));

  object('intro_badge', { type: 'asset', asset: 'bulb', x: 585, y: 132, scale: 1.125 });
  path('intro_ring', ring(148), 720, 267);
  label('intro_series', '一起学个新知识', 720, 585, 78);
  path('intro_band', ribbon(850, 122), 295, 653, C.yellow);
  label('intro_topic', topic, 720, 738, Math.min(67, 780 / (Array.from(topic).length * 1.03)));
  action('draw', 'intro_badge', .05, .9);
  action('draw', 'intro_ring', .15, 1.1);
  action('draw', 'intro_series', .85, 1.4);
  action('draw', 'intro_band', 1.65, .9);
  action('write', 'intro_topic', 2.0, 1.65);
  for (const key of ['intro_badge', 'intro_ring', 'intro_series', 'intro_band', 'intro_topic']) {
    action('erase', key, 6.65, .85);
  }
  object('header_badge', { type: 'asset', asset: 'bulb', x: 55, y: 18, scale: 65 / 240 });
  // Label anchors are centers; its left edge begins near x=160.
  label('header_topic', topic, 160 + Array.from(topic).length * 35 * .515, 58, 35);
  action('draw', 'header_badge', 7.3, .42);
  action('write', 'header_topic', 7.3, .42);

  result.actions = result.actions.map(a => ({ ...a, at: time(a.at + INTRO_DURATION) }));
  for (const o of result.objects) {
    actions.push({ type: 'erase', target: o.id, at: outro, duration: .38 });
  }
  action('erase', 'header_badge', outro, .38);
  action('erase', 'header_topic', outro, .38);
  actions.push({ type: 'camera', at: outro, duration: .38, x: 0, y: 0, scale: 1, rotation: 0 });

  object('end_badge', { type: 'asset', asset: 'bulb', x: 606.5, y: 116.5, scale: 227 / 240 });
  path('end_ring', ring(125), 720, 230);
  label('end_series', '一起学个新知识', 720, 449, 55);
  path('end_band', ribbon(602, 97), 419, 490, C.yellow);
  label('end_topic', topic, 720, 563, topicSize(51));
  label('end_next', '下次继续学', 681, 855, 68, C.gold);
  path('end_arrow', 'M 0 6 L 80 0 M 61 -14 L 80 0 L 63 17', 893, 820);
  path('end_underline', 'M 0 4 Q 168 -21 295 5 Q 419 19 552 0', 446, 888);
  action('draw', 'end_badge', outro + .4, .9);
  action('draw', 'end_ring', outro + .4, .9);
  action('draw', 'end_series', outro + .55, 1);
  action('draw', 'end_band', outro + .9, .7);
  action('write', 'end_topic', outro + 1.2, 1.2);
  action('write', 'end_next', outro + 3, 1.35);
  action('connect', 'end_arrow', outro + 4.2, .55);
  action('draw', 'end_underline', outro + 4.3, .9);

  if (concept !== undefined) {
    image('end_concept', concept, 81, 326, 260, 420);
    image('end_application', application, 1099, 326, 260, 420);
    action('draw', 'end_concept', outro + .4, 1);
    action('draw', 'end_application', outro + .65, 1);
  }
  if (contributor !== undefined) {
    label('end_contributor', `贡献者：${contributor}`, 720, 650, Math.min(28, 550 / ((Array.from(contributor).length + 4) * 1.03)));
    action('write', 'end_contributor', outro + 1.9, .7);
  }
  if (reference !== undefined) {
    const chars = Array.from(`参考：${reference}`);
    for (let i = 0; i < chars.length; i += 22) {
      const key = `end_reference_${i / 22}`;
      label(key, chars.slice(i, i + 22).join(''), 720, 700 + (i / 22) * 31, 23);
      action('write', key, outro + 2.4 + (i / 22) * .2, .8);
    }
  }

  result.objects.push(...added);
  result.actions.push(...actions);
  result.actions.sort((a, b) => a.at - b.at);
  result.chapters = [
    { title: '片头', at: 0 },
    ...(story.chapters?.length ? story.chapters : [{ title: story.title, at: 0 }])
      .map(c => ({ ...c, at: time(c.at + INTRO_DURATION) })),
    { title: '片尾', at: outro },
  ];
  if (result.audio) result.audio = result.audio.map(a => ({ ...a, at: time(a.at + INTRO_DURATION) }));
  return validateStory(result);
}
