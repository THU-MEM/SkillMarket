import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStory } from '../src/schema.mjs';
import fs from 'node:fs';

const body = () => ({
  id: 'sample', title: '邻里互助', duration: 20,
  objects: [{ id: 'message', type: 'label', text: '搭把手', x: 400, y: 400, size: 40 }],
  actions: [{ type: 'write', target: 'message', at: 0, duration: 1 }],
  chapters: [{ title: '正文', at: 0 }],
});
async function api() {
  const module = await import('../src/templates.mjs').catch(() => ({}));
  assert.equal(typeof module.withBookends, 'function', 'withBookends is implemented');
  return module.withBookends;
}

test('neutral teaching bookends surround an unchanged, shifted body', async () => {
  const withBookends = await api();
  const original = body(), before = structuredClone(original);
  const result = withBookends(original);
  assert.equal(validateStory(result), result);
  assert.deepEqual(original, before);
  assert.equal(result.duration, 35.72);
  assert.equal(result.actions.find(a => a.target === 'message' && a.type === 'write').at, 7.72);
  assert.equal(result.objects.filter(o => o.asset === 'bulb').length, 3);
  assert.equal(result.objects.filter(o => o.text === '一起学个新知识').length, 2);
  assert(!result.objects.some(o => o.type === 'image'));
  assert(!result.objects.some(o => /contributor|reference|concept|application/.test(o.id)));
  assert(!Object.hasOwn(result, 'audio'));
  assert(result.actions.every(a => a.at + a.duration <= result.duration - 2));
});

test('paired local cards and attribution are explicit opt-ins', async () => {
  const withBookends = await api();
  const concept = 'assets/cards/placeholder.svg';
  const application = 'assets/cards/placeholder.svg';
  const result = withBookends(body(), { topic: '牛鞭效应', concept, application, contributor: '示例作者', reference: '教学演示' });
  const left = result.objects.find(o => o.id.endsWith('end_concept'));
  const right = result.objects.find(o => o.id.endsWith('end_application'));
  assert.deepEqual([left?.x, left?.y, left?.width, left?.height], [81, 326, 260, 420]);
  assert.deepEqual([right?.x, right?.y, right?.width, right?.height], [1099, 326, 260, 420]);
  assert(result.objects.some(o => o.type === 'label' && o.text === '贡献者：示例作者'));
  assert(result.objects.some(o => o.type === 'label' && o.text === '参考：教学演示'));
  assert.throws(() => withBookends(body(), { concept }), /pair|both/i);
  assert.throws(() => withBookends(body(), { concept: '../escape.png', application }), /asset/i);
});

test('restores the camera before neutral ending and preserves optional audio', async () => {
  const withBookends = await api();
  const input = body();
  input.objects[0].id = 'sb_intro_badge';
  input.actions[0].target = 'sb_intro_badge';
  input.actions.push({ type: 'camera', at: 2, duration: 1, x: -80, y: -40, scale: 1.1, rotation: 4 });
  input.audio = [{ src: 'assets/explicit-voice.wav', at: 1, duration: 2 }];
  const result = withBookends(input);
  assert.equal(result.audio[0].at, 8.72);
  const camera = result.actions.filter(a => a.type === 'camera').at(-1);
  assert.deepEqual([camera.x, camera.y, camera.scale, camera.rotation], [0, 0, 1, 0]);
  assert(camera.at + camera.duration <= result.actions.find(a => a.type === 'draw' && a.target.endsWith('end_badge')).at);
  assert.equal(new Set(result.objects.map(o => o.id)).size, result.objects.length);
  assert.throws(() => withBookends({ ...input, duration: NaN }), /duration/);
  assert.throws(() => withBookends(body(), { topic: '' }), /topic/);
});

for (const name of ['bullwhip', 'helping-neighbor']) {
  test(`${name} is a reusable continuous body with a two-second final hold`, async () => {
    const file = new URL(`../examples/${name}.json`, import.meta.url);
    assert(fs.existsSync(file), `Missing example ${name}`);
    const story = validateStory(JSON.parse(fs.readFileSync(file, 'utf8')));
    assert(story.duration >= 18 && story.duration <= 24);
    assert(!Object.hasOwn(story, 'audio'));
    assert(story.actions.every(a => a.at + a.duration <= story.duration - 2));
    assert(story.objects.every(o => o.type !== 'image'));
    assert(story.objects.filter(o => o.type === 'label').every(o => Array.from(o.text).length <= 12));
    for (const a of story.actions.filter(a => a.type === 'hand-draw')) {
      const hand = story.objects.find(o => o.id === a.hand);
      assert.deepEqual([hand.x, hand.y, hand.scale], [0, 0, 1]);
    }
    const assets = new Set(story.objects.map(o => o.asset));
    for (const needed of name === 'bullwhip' ? ['shop', 'box', 'factory'] : ['person', 'box', 'bulb']) assert(assets.has(needed));
    const types = new Set(story.actions.map(a => a.type));
    for (const needed of ['hand-draw', 'move', 'write', 'emphasize']) assert(types.has(needed));
    const withBookends = await api();
    validateStory(withBookends(story));
  });
}
