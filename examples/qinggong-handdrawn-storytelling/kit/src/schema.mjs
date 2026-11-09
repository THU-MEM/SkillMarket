export const ACTIONS=Object.freeze(['draw','write','connect','move','emphasize','erase','camera','hand-draw']);
const finite=(n,msg)=>{if(!Number.isFinite(n))throw Error(msg);};
export function localAsset(src){if(typeof src!=='string'||!/^assets\/[A-Za-z0-9_\-./]+$/.test(src)||src.split('/').includes('..')||src.includes('//'))throw Error('invalid local asset path');return src;}
export function validateStory(s){
 if(!s||!/^[-a-zA-Z0-9_]+$/.test(s.id)||typeof s.title!=='string')throw Error('invalid story id/title');
 finite(s.duration,'invalid duration');if(s.duration<=0||s.duration>3600)throw Error('invalid duration');
 if(!Array.isArray(s.objects)||!Array.isArray(s.actions))throw Error('objects/actions required');
 const ids=new Set();
 for(const o of s.objects){
  if(!/^[a-zA-Z_][\w-]*$/.test(o.id))throw Error('invalid object id');if(ids.has(o.id))throw Error('duplicate object id');ids.add(o.id);
  if(!['asset','label','image','path'].includes(o.type))throw Error('unknown object type');
  for(const n of ['x','y','scale','size','width','height','rotation','strokeWidth','seed'])if(o[n]!==undefined){finite(o[n],'invalid geometry');if(['scale','size','width','height','strokeWidth'].includes(n)&&o[n]<=0)throw Error('invalid geometry');}
  if(o.color!==undefined&&!/^#[\da-f]{6}$/i.test(o.color))throw Error('invalid color');
  if(o.type==='asset'&&typeof o.asset!=='string')throw Error('asset name required');
  if(o.type==='label'&&(typeof o.text!=='string'||!o.text.length||o.text.length>160))throw Error('invalid label');
  if(o.type==='image'){localAsset(o.src);if(!(o.width>0&&o.height>0))throw Error('image size required');}
  if(o.type==='path'&&(typeof o.d!=='string'||!/^\s*M[\d\s.,+\-eEMmLlHhVvCcSsQqTtAaZz]+$/.test(o.d)))throw Error('invalid SVG path');
 }
 for(const a of s.actions){
  if(!ACTIONS.includes(a.type))throw Error('unknown action');
  finite(a.at,'invalid time');finite(a.duration,'invalid duration');if(a.at<0||a.duration<=0||a.at+a.duration>s.duration+.00001)throw Error('action time beyond duration');
  if(a.type!=='camera'&&!ids.has(a.target))throw Error('missing action target');
  if(a.type==='hand-draw'&&!ids.has(a.hand))throw Error('missing drawing hand');
  for(const n of ['x','y','scale','rotation','amount'])if(a[n]!==undefined)finite(a[n],'invalid action geometry');
  if(a.scale!==undefined&&a.scale<=0)throw Error('invalid camera scale');
 }
 for(const draw of s.actions.filter(a=>a.type==='hand-draw')){
  if(s.actions.some(a=>a.target===draw.target&&['move','emphasize'].includes(a.type)&&a.at<draw.at+draw.duration&&draw.at<a.at+a.duration))throw Error('hand-draw cannot overlap target transforms');
 }
 for(const c of s.chapters??[]){finite(c.at,'invalid chapter time');if(c.at<0||c.at>=s.duration||typeof c.title!=='string')throw Error('invalid chapter');}
 for(const a of s.audio??[]){localAsset(a.src);finite(a.at,'audio time');finite(a.duration,'audio duration');if(a.at<0||a.duration<=0||a.at+a.duration>s.duration+.1)throw Error('audio beyond duration');}
 return s;
}
