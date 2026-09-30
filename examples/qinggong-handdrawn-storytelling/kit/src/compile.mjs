import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import opentype from 'opentype.js';
import {validateStory,localAsset} from './schema.mjs';import {asset,PALETTE} from './assets.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const theme=JSON.parse(fs.readFileSync(path.join(ROOT,'theme.json'),'utf8'));
const {width:W,height:H,fps:FPS}=theme.canvas;
const buffer=fs.readFileSync(path.join(ROOT,localAsset(theme.typeface.file)));
const font=opentype.parse(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength));
const js=fs.readFileSync(path.join(ROOT,'node_modules/gsap/dist/gsap.min.js'),'utf8');
const runtime=fs.readFileSync(path.join(ROOT,'src/runtime.js'),'utf8').replace('export function','function');
export const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function embedded(src){localAsset(src);const p=fs.realpathSync(path.join(ROOT,src));if(!p.startsWith(path.join(ROOT,'assets')+path.sep))throw Error('asset outside root');const mime={'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.wav':'audio/wav','.mp3':'audio/mpeg'}[path.extname(p)];if(!mime)throw Error('unsupported asset format');return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;}
export function labelPaths(text,size=52,color=PALETTE.ink){
 const out=[];let x=0;
 for(const ch of text){const g=font.charToGlyph(ch);if(g.index===0&&!/\s/.test(ch))throw Error('missing font glyph '+ch);const d=g.getPath(x,0,size).toPathData(3);if(d)out.push(`<path data-glyph="true" d="${d}" fill="${color}" stroke="${color}" stroke-width=".6" stroke-linejoin="round"/>`);x+=(g.advanceWidth/font.unitsPerEm+.03)*size;}
 return {markup:out.join(''),width:x};
}
export function objectMarkup(o){
 let inner='';
 if(o.type==='asset'){const props={};for(const k of ['pose','seed','palette'])if(o[k]!==undefined)props[k]=o[k];if(o.color)props.palette={...(props.palette??{}),ink:o.color};inner=asset(o.asset,props).markup;}
 else if(o.type==='label'){const l=labelPaths(o.text,o.size??52,o.color??PALETTE.ink);inner=`<g transform="translate(${-l.width/2} 0)">${l.markup}</g>`;}
 else if(o.type==='path')inner=`<path d="${escape(o.d)}" fill="none" stroke="${o.color??PALETTE.ink}" stroke-width="${o.strokeWidth??5}" stroke-linecap="round" stroke-linejoin="round"/>`;
 else inner=`<image href="${embedded(o.src)}" width="${o.width}" height="${o.height}"/>`;
 return `<g data-object="${o.id}" transform="translate(${o.x??0} ${o.y??0}) scale(${o.scale??1})" style="opacity:0"><g data-motion="${o.id}"><g data-emphasis="${o.id}">${inner}</g></g></g>`;
}
export function compileStory(story,{inlineDependencies=false}={}){
 validateStory(story);const safe=JSON.stringify(story).replaceAll('<','\\u003c');
 const markup=story.objects.map(objectMarkup).join('\n');
 const audio=(story.audio??[]).map((a,i)=>`<audio id="voice-${i}" class="clip" src="${embedded(a.src)}" data-start="${a.at}" data-duration="${a.duration}" data-volume="1" data-track-index="10"></audio>`).join('');
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escape(story.title)}</title><style>*{box-sizing:border-box}body{margin:0;background:${PALETTE.paper}}[data-composition-id]{position:relative;width:100%;height:100%;overflow:hidden}svg{width:100%;height:100%;display:block}</style>${inlineDependencies?`<script>${js}</script>`:'<script src="assets/gsap.min.js"></script>'}</head><body><div id="film" data-composition-id="${story.id}" data-width="${W}" data-height="${H}" data-duration="${story.duration}" data-fps="${FPS}"><svg data-board viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="${PALETTE.paper}"/><g data-camera>${markup}</g></svg>${audio}</div><script>${runtime}\nconst story=${safe};const timeline=createStoryTimeline(document.getElementById('film'),story,gsap);window.__timelines=window.__timelines||{};window.__timelines[story.id]=timeline;window.story=story;</script></body></html>`;
}
