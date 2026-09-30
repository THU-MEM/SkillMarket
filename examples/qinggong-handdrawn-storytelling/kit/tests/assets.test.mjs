import test from 'node:test';
import assert from 'node:assert/strict';

import * as lib from '../src/assets.mjs';

const required = ['person', 'drawing-hand', 'pen', 'shop', 'factory', 'warehouse', 'box', 'bulb', 'clock', 'speech-bubble', 'note', 'blank-card', 'arrow', 'check', 'cross', 'cloud'];

test('complete catalog produces deterministic, reusable path-only fragments', () => {
  assert.deepEqual([...lib.ASSET_IDS].sort(), [...required].sort());
  const variants = required.map(type => [type, {}]).concat(
    ['neutral', 'talk', 'think', 'celebrate'].map(pose => ['person', { pose }]),
  );
  for (const [type, props] of variants) {
    const result = lib.asset(type, props);
    assert.equal(result.width, 240, type);
    assert.equal(result.height, 240, type);
    assert.match(result.markup, /^<path /, type);
    assert.doesNotMatch(result.markup, /<(?!path\b)|\b(?:id|href|style|on\w+)\s*=|url\(|NaN|Infinity/i, type);
    assert.deepEqual(result, lib.asset(type, props));
    lib.asset('box', { seed: 99 });
    assert.deepEqual(result, lib.asset(type, props), 'independent call order');
    assert.deepEqual(result.anchors.origin, { x: 0, y: 0 });
    for (const point of Object.values(result.anchors)) {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
    }
  }
  assert.equal(new Set(variants.map(([type, props]) => lib.asset(type, props).markup)).size, required.length + 3);
});

test('hand and pen declare the exact nib origin and explicit down-right layout', () => {
  for (const type of ['drawing-hand', 'pen']) {
    const item = lib.asset(type);
    assert.deepEqual(item.anchors.tip, { x: 0, y: 0 });
    assert.match(item.markup, /d="M 0 0 L 18 9 L 9 18 Z"/, 'un-jittered nib at the actual anchor');
    assert.deepEqual(item.anchors.grip, { x: 55, y: 55 });
    assert.ok(item.anchors.wrist.x > item.anchors.grip.x);
    assert.ok(item.anchors.wrist.y > item.anchors.grip.y);
  }
});

test('validated palette overrides are restricted to named roles and approved colors', () => {
  const themed = lib.asset('person', { palette: { blue: lib.PALETTE.purple }, pose: 'talk', seed: 42 });
  assert.match(themed.markup, /#593579/);
  assert.doesNotMatch(themed.markup, /#c0d5dd/);
  assert.equal(lib.PALETTE.blue, '#c0d5dd');
  assert.ok(Object.isFrozen(lib.PALETTE));
  assert.ok(Object.isFrozen(lib.ASSET_IDS));
});

test('rejects unsupported options, unsafe XML values and invalid seed/pose inputs', () => {
  for (const type of ['unknown', '__proto__', '<script>', undefined, null, 5]) {
    assert.throws(() => lib.asset(type), /asset/i);
  }
  for (const props of [null, [], 'red', 3, { color: '#fff' }, { markup: '<script/>' },
    { seed: 0 }, { seed: -1 }, { seed: 1.2 }, { seed: NaN }, { seed: Infinity },
    { seed: 2147483647 }, { seed: '17' }, { seed: null },
    { pose: 'run' }, { pose: '__proto__' }, { pose: '<script>' }, { pose: null },
    { palette: null }, { palette: [] }, { palette: { blue: '#ffffff' } },
    { palette: { blue: 'url(https://invalid.test/a)' } },
    { palette: { blue: '\"/><script/>' } }, { palette: { unknown: '#282039' } },
    Object.create({ seed: 3 }), JSON.parse('{"__proto__":{"seed":3}}')]) {
    assert.throws(() => lib.asset('person', props), /asset|props|seed|pose|palette/i, JSON.stringify(props));
  }
  assert.throws(() => lib.asset('box', { pose: 'talk' }), /pose/i);
  for (const seed of [1, 17, 2147483646]) {
    assert.deepEqual(lib.asset('cloud', { seed }), lib.asset('cloud', { seed }));
  }
});

test('box: seeded procedural SVG, dimensions and palette contract', () => {
  assert.equal(typeof lib.asset, 'function', 'asset dispatcher must exist');
  assert.equal(lib.PALETTE.paper, '#faf6eb');
  assert.equal(lib.PALETTE.ink, '#282039');
  const box = lib.asset('box', { seed: 17 });
  assert.deepEqual(Object.keys(box).sort(), ['anchors', 'height', 'markup', 'width']);
  assert.equal(box.width, 240);
  assert.equal(box.height, 240);
  assert.match(box.markup, /<path /);
  assert.deepEqual(box, lib.asset('box', { seed: 17 }));
  assert.notEqual(box.markup, lib.asset('box', { seed: 18 }).markup);
  assert.deepEqual(box.anchors.origin, { x: 0, y: 0 });
});
