import assert from 'node:assert/strict';
import {whipPoints,whipPath,buildWhipMotion} from './whip-motion.mjs';
const samples=Array.from({length:97},(_,i)=>whipPoints(i/24));
const range=a=>Math.max(...a)-Math.min(...a);
assert(range(samples.map(p=>p.at(-1).y))>420,'tip must actually sweep more than 420px');
assert(range(samples.map(p=>p[4].y))<45,'handle-side movement stays small');
for(const points of samples){assert.deepEqual(points[0],{x:419,y:498});for(const p of points){assert(p.x>=418&&p.x<=1290);assert(p.y>285&&p.y<810);}}
assert.equal(whipPath(1),whipPath(1));assert.notEqual(whipPath(1),whipPath(1.5));
const m=buildWhipMotion(26,43);assert(m.runtime.includes('strokeDasharray'));assert(m.frames.length>350);assert.equal(m.frames.at(-1).at,43);assert(m.proof.tipRangeY>420);
console.log('PASS moving endpoint, small handle-side amplitude, bounds, deterministic path, full-length reveal reset');
