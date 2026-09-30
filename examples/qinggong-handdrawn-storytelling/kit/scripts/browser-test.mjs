import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {pathToFileURL} from 'node:url';import puppeteer from 'puppeteer-core';
const chromeCache=path.join(process.env.HOME??process.env.USERPROFILE??'', '.cache/puppeteer/chrome');
const cached=fs.existsSync(chromeCache)?fs.readdirSync(chromeCache).sort().reverse().flatMap(v=>['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing','chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing','chrome-linux64/chrome','chrome-win64/chrome.exe'].map(p=>path.join(chromeCache,v,p))):[];
const windows=['LOCALAPPDATA','PROGRAMFILES','PROGRAMFILES(X86)'].flatMap(key=>process.env[key]?[path.join(process.env[key],'Google','Chrome','Application','chrome.exe'),path.join(process.env[key],'Microsoft','Edge','Application','msedge.exe')]:[]);
const candidates=[...cached,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser',...windows];
const executablePath=process.env.CHROME_BIN||candidates.find(p=>fs.existsSync(p));if(!executablePath||!fs.existsSync(executablePath))throw Error('Set CHROME_BIN to the executable file of an installed Chromium browser');
fs.mkdirSync('evidence',{recursive:true});const browser=await puppeteer.launch({executablePath,headless:true,args:['--allow-file-access-from-files']});const page=await browser.newPage();await page.setViewport({width:1440,height:1080,deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));const report={projects:[],handTip:[],seekDeterministic:false,gallery:false};
try{
 const {compileStory}=await import('../src/compile.mjs');
 const composition={id:'composition-regression',title:'Composition',duration:8,objects:[{id:'route',type:'path',d:'M 100 100 L 300 100',x:40,y:30,scale:1.2},{id:'hand',type:'asset',asset:'drawing-hand',scale:.65}],actions:[{type:'move',target:'route',at:0,duration:1,x:200,y:50,scale:2,rotation:15},{type:'hand-draw',target:'route',hand:'hand',at:2,duration:2}]};
 await page.setContent(compileStory(composition,{inlineDependencies:true}));
 report.movedHand=[];
 for(const time of [2.3,3,3.7,7,3,0,2.3]){
  const result=await page.evaluate(time=>{const tl=Object.values(window.__timelines)[0];tl.seek(time,false);if(time<2||time>=4)return null;const path=document.querySelector('[data-motion="route"] path'),hand=document.querySelector('[data-motion="hand"]'),svg=document.querySelector('svg'),point=svg.createSVGPoint();const hp=point.matrixTransform(hand.getCTM()),q=path.getPointAtLength(path.getTotalLength()*(time-2)/2);point.x=q.x;point.y=q.y;const pp=point.matrixTransform(path.getCTM());return {time,error:Math.hypot(hp.x-pp.x,hp.y-pp.y)};},time);
  if(result){report.movedHand.push(result);assert(result.error<1.2,'moved nib '+JSON.stringify(result));}
 }
 const emphasis={...composition,id:'emphasis-regression',actions:[{type:'draw',target:'route',at:0,duration:.2},{type:'move',target:'route',at:.3,duration:.7,scale:2},{type:'emphasize',target:'route',at:2,duration:2,amount:1.2}]};
 await page.goto('about:blank');await page.setContent(compileStory(emphasis,{inlineDependencies:true}));
 report.emphasis=[];
 for(const time of [1.5,3,4.5,7,3,1.5,4.5]){
  const scale=await page.evaluate(time=>{Object.values(window.__timelines)[0].seek(time,false);const m=document.querySelector('[data-motion="route"] path').getCTM();return Math.hypot(m.a,m.b);},time);
  const expected=1.2*2*(time===3?1.2:1);report.emphasis.push({time,scale});assert(Math.abs(scale-expected)<.001,`emphasis at ${time}: ${scale} != ${expected}`);
 }
 const manifest=JSON.parse(fs.readFileSync('build-manifest.json','utf8'));
 for(const p of manifest.projects){
  await page.goto(pathToFileURL(path.resolve('projects',p.id,'index.html')).href);await page.waitForFunction(()=>window.__timelines&&Object.keys(window.__timelines).length);
  const d=await page.evaluate(()=>Object.values(window.__timelines)[0].duration());assert(Math.abs(d-p.duration)<.01);
  const times=p.id==='action-hand-draw'?[.3,.8,1.5,2.2,2.6]:[0,Math.min(2,p.duration/2),p.duration-.25];
  for(const t of times){await page.evaluate(t=>{Object.values(window.__timelines)[0].pause().seek(t,false);},t);
   const counts=await page.evaluate(()=>({svgText:document.querySelectorAll('svg text').length,paths:document.querySelectorAll('path').length,visible:[...document.querySelectorAll('[data-object]')].filter(e=>Number(getComputedStyle(e).opacity)>.1).length}));assert.equal(counts.svgText,0);assert(counts.paths>0);if(p.id==='action-erase'&&t>4.9)assert.equal(counts.visible,0);else if(t>0)assert(counts.visible>0,p.id+' blank');
   if(p.id==='action-hand-draw'){
    const check=await page.evaluate(t=>{const tl=Object.values(window.__timelines)[0],s=tl.__handTrace.find(x=>t>=x.start&&t<x.end);if(!s)return null;const root=document.querySelector('svg');const hand=document.querySelector(`[data-motion="${s.hand}"]`);const g=document.querySelector(`[data-motion="${s.target}"]`);const paths=[...g.querySelectorAll('path')].filter(p=>p.getAttribute('fill')==='none'||p.hasAttribute('data-glyph'));const path=paths[s.pathIndex],point=root.createSVGPoint();let hp=point.matrixTransform(hand.getCTM());let q=path.getPointAtLength(path.getTotalLength()*(t-s.start)/(s.end-s.start));point.x=q.x;point.y=q.y;let pp=point.matrixTransform(path.getCTM());return {time:t,error:Math.hypot(hp.x-pp.x,hp.y-pp.y),hand:[hp.x,hp.y],path:[pp.x,pp.y]};},t);assert(check);assert(check.error<1.2,JSON.stringify(check));report.handTip.push(check);
   }
  }
  await page.screenshot({path:`evidence/${p.id}.png`});report.projects.push(p.id);
 }
 await page.goto(pathToFileURL(path.resolve('projects/motion-showcase/index.html')).href);await page.evaluate(()=>{Object.values(window.__timelines)[0].pause().seek(8,false);});const a=await page.screenshot();await page.evaluate(()=>{const t=Object.values(window.__timelines)[0];t.seek(20,false);t.seek(8,false)});const b=await page.screenshot();assert.equal(crypto.createHash('sha256').update(a).digest('hex'),crypto.createHash('sha256').update(b).digest('hex'));report.seekDeterministic=true;await page.screenshot({path:'evidence/hand-drawing.png'});
 await page.goto(pathToFileURL(path.resolve('storyboard.html')).href);await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow?.__timelines);await page.click('#play');await page.waitForFunction(()=>Number(document.querySelector('#seek').value)>.1);await page.click('#play');
 await page.click('[data-project="action-hand-draw"]');await page.waitForFunction(()=>document.querySelector('iframe').contentWindow.story?.id==='action-hand-draw');await page.$eval('#seek',el=>{el.value='1.5';el.dispatchEvent(new Event('input'))});
 await page.click('[data-asset="drawing-hand"]');assert((await page.$eval('#assetdetail',e=>e.textContent)).includes('drawing-hand'));await page.screenshot({path:'evidence/storyboard-desktop.png',fullPage:true});await page.setViewport({width:390,height:844,deviceScaleFactor:1});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2));await page.screenshot({path:'evidence/storyboard-mobile.png',fullPage:true});report.gallery=true;assert.equal(errors.length,0,errors.join('\n'));report.pageErrors=errors;report.passed=true;
 fs.writeFileSync('evidence/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close()}
