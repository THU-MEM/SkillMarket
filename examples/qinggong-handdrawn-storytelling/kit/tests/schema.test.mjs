import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStory,ACTIONS} from '../src/schema.mjs';
const sample=()=>({id:'demo',title:'小故事',duration:8,objects:[{id:'pen',type:'asset',asset:'pen',x:0,y:0},{id:'route',type:'path',d:'M 100 100 L 300 300',x:0,y:0}],actions:[{type:'hand-draw',target:'route',hand:'pen',at:1,duration:3}],chapters:[{title:'开始',at:0}]});
test('valid story is unchanged and permits reusable objects',()=>{let s=sample();assert.equal(validateStory(s),s);assert(ACTIONS.includes('camera'));});
test('hand-draw rejects overlapping target transforms regardless of action order',()=>{
 for(const type of ['move','emphasize'])for(const at of [0,1,2,3.9])for(const reverse of [false,true]){
  const s=sample();s.actions.push({type,target:'route',at,duration:2,scale:2});if(reverse)s.actions.reverse();
  assert.throws(()=>validateStory(s),/hand-draw.*transform/);
 }
});
test('hand-draw permits adjacent transforms, unrelated motion and shared camera motion',()=>{
 const s=sample();s.actions.push({type:'move',target:'route',at:0,duration:1,x:200},{type:'emphasize',target:'route',at:4,duration:1},{type:'camera',at:1,duration:3,scale:2});assert.equal(validateStory(s),s);
});
test('unknown action fails',()=>{let s=sample();s.actions[0].type='eval';assert.throws(()=>validateStory(s),/action/)});
test('duplicate object id fails',()=>{let s=sample();s.objects.push({...s.objects[0]});assert.throws(()=>validateStory(s),/duplicate/)});
test('missing target fails',()=>{let s=sample();s.actions[0].target='missing';assert.throws(()=>validateStory(s),/target/)});
test('invalid timing fails',()=>{for(const n of [NaN,Infinity,-1]){let s=sample();s.actions[0].at=n;assert.throws(()=>validateStory(s),/time/)};let s=sample();s.actions[0].duration=9;assert.throws(()=>validateStory(s),/duration|beyond/)});
test('missing hand fails',()=>{let s=sample();s.actions[0].hand='absent';assert.throws(()=>validateStory(s),/hand/)});
test('image paths reject network, traversal and markup',()=>{for(const src of ['https://x/a.svg','../private.png','/etc/passwd','data:image/svg+xml,a','assets/"x.png']){let s=sample();s.objects.push({id:'image',type:'image',src,width:100,height:100,x:0,y:0});assert.throws(()=>validateStory(s),/asset path/)}});
test('caption content stays data',()=>{let s=sample();s.objects.push({id:'word',type:'label',text:'<script>alert(1)</script>',size:40,x:30,y:60});assert.equal(validateStory(s),s)});
test('bad ID, bad geometry and unsafe color fail',()=>{for(const change of [o=>o.id='x\" onclick=',o=>o.x=Infinity,o=>o.color='url(https://x)']){let s=sample();change(s.objects[0]);assert.throws(()=>validateStory(s))}});
test('unknown object type and invalid camera fail',()=>{let s=sample();s.objects[0].type='script';assert.throws(()=>validateStory(s));s=sample();s.actions.push({type:'camera',at:4,duration:2,scale:0});assert.throws(()=>validateStory(s))});
