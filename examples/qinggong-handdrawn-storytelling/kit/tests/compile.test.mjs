import test from 'node:test';import assert from 'node:assert/strict';import {compileStory} from '../src/compile.mjs';
const simple=()=>({id:'story',title:'测试',duration:5,objects:[{id:'word',type:'label',text:'牛鞭效应',x:200,y:200,size:80}],actions:[{type:'write',target:'word',at:0,duration:2}],chapters:[]});
test('compiles to self-contained HyperFrames SVG without text elements',()=>{const h=compileStory(simple());assert(h.includes('data-composition-id="story"'));assert(h.includes('data-glyph'));assert(!h.includes('<text'));assert(!h.includes('http://localhost'));assert(h.includes('createStoryTimeline'));});
test('build is byte deterministic',()=>assert.equal(compileStory(simple()),compileStory(simple())));
test('placeholder image is embedded and missing path fails closed',()=>{let s=simple();s.objects.push({id:'badge',type:'image',src:'assets/cards/placeholder.svg',width:100,height:100,x:20,y:20});assert(compileStory(s).includes('data:image/svg+xml;base64,'));s.objects[1].src='assets/absent.svg';assert.throws(()=>compileStory(s));});
test('script-shaped title is not executable',()=>{let s=simple();s.title='</script><script>evil()</script>';const h=compileStory(s);assert(!h.includes('<script>evil()'));assert(h.includes('\\u003c/script>'));});
test('unknown font glyph is explicit failure',()=>{let s=simple();s.objects[0].text='🪿';assert.throws(()=>compileStory(s),/glyph/)});
