// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';

const expected = ['neutral','happy','laugh','sad','cry','think','confused','wave','point','explain','worried','celebrate'];
const load = () => import('../src/person-poses.mjs');

test('reject invalid enums, arbitrary XML, getters and non-data options', async () => {
  const {personAsset} = await load();
  for (const pose of ['talk', '__proto__', 'constructor', '', '<script/>', null, 1, {}, ['cry']]) {
    assert.throws(() => personAsset(pose), TypeError);
  }
  for (const options of [null, [], 'blue', Object.create(null), {shirt:'red'}, {shirt:undefined}, {shirt:'<script/>'}, {seed:0}, {seed:NaN}, {seed:Infinity}, {seed:1.5}, {seed:2147483647}, {seed:'17'}, {seed:undefined}, {xml:'<script/>'}, {style:'color:red'}, {palette:{ink:'red'}}, {[Symbol('x')]:1}]) {
    assert.throws(() => personAsset('cry',options));
  }
  let ran = false;
  const accessor = {get shirt(){ran=true;return 'blue';}};
  assert.throws(() => personAsset('cry',accessor), TypeError);
  assert.equal(ran,false,'must reject accessors without executing them');
});

test('bounded seeds and shirt enum are stable and input remains unchanged', async () => {
  const {personAsset,PERSON_POSES} = await load();
  for (const seed of [1,17,2147483646]) for (const shirt of ['blue','green']) {
    const options = Object.freeze({seed,shirt});
    for (const pose of PERSON_POSES) {
      const a = personAsset(pose,options);
      assert.deepEqual(a,personAsset(pose,options));
      assert.match(a.markup,shirt === 'blue' ? /#c0d5dd/ : /#b6ccb2/);
      assert.doesNotMatch(a.markup,/NaN|undefined|Infinity|script|onload|href/i);
    }
  }
  const a = personAsset('think');
  a.anchors.head.x = -999;
  assert.equal(personAsset('think').anchors.head.x,120);
});

test('12 named poses, deterministic transparent fragments, distinct face and limbs', async () => {
  const { PERSON_POSES, personAsset } = await load();
  assert.deepEqual(PERSON_POSES, expected);
  assert.equal(Object.isFrozen(PERSON_POSES), true);
  const faces = new Set(), limbs = new Set(), outputs = new Set();
  for (const pose of expected) {
    const a = personAsset(pose, {seed: 17});
    assert.deepEqual(a, personAsset(pose, {seed: 17}));
    assert.equal(a.width, 240); assert.equal(a.height, 240);
    for (const key of ['origin','center','head','feet','leftHand','rightHand']) {
      assert.equal(typeof a.anchors[key].x, 'number');
      assert.equal(typeof a.anchors[key].y, 'number');
    }
    assert.doesNotMatch(a.markup, /<(?:script|text|foreignObject|image|rect)\b|\bon\w+=|href=|url\(/i);
    assert.match(a.markup, /#faf6eb/);
    faces.add(a.markup.match(/<g data-part="face"[^>]*>([\s\S]*?)<\/g>/)[1]);
    limbs.add(a.markup.match(/<g data-part="limbs"[^>]*>([\s\S]*?)<\/g>/)[1]);
    outputs.add(a.markup);
  }
  assert.equal(faces.size, 12); assert.equal(limbs.size, 12); assert.equal(outputs.size, 12);
  assert.notEqual(personAsset('happy',{seed: 1}).markup, personAsset('happy',{seed: 2}).markup);
  personAsset('cry');
  assert.deepEqual(personAsset('neutral'), personAsset('neutral',{seed:17}));
});
