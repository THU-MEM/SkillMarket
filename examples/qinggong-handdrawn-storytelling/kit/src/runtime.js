export function createStoryTimeline(root,story,gsap){
 const board=root.querySelector('[data-board]'),camera=root.querySelector('[data-camera]');
 const object=id=>root.querySelector('[data-object="'+id+'"]'),motion=id=>root.querySelector('[data-motion="'+id+'"]');
 const tl=gsap.timeline({paused:true});
 const trace=[];
 function draw(a){
  const g=motion(a.target),outer=object(a.target);tl.set(outer,{opacity:1},a.at);
  const strokes=[...g.querySelectorAll('path')].filter(p=>p.getAttribute('fill')==='none'||p.hasAttribute('data-glyph'));
  const filled=[...g.querySelectorAll('path')].filter(p=>!strokes.includes(p));
  if(!strokes.length){tl.fromTo(g,{opacity:0},{opacity:1,duration:a.duration},a.at);return;}
  const lengths=strokes.map(p=>Math.max(.01,p.getTotalLength()));const total=lengths.reduce((x,y)=>x+y,0);let cursor=a.at;
  const hand=a.type==='hand-draw'?motion(a.hand):null;
  // Resolve prior motion before sampling SVG coordinates, then rewind construction.
  if(hand)tl.seek(a.at,true);
  for(const [i,p] of strokes.entries()){
   const n=lengths[i],d=a.duration*n/total;
   tl.fromTo(p,{strokeDasharray:n+' '+n,strokeDashoffset:n,fillOpacity:0},{strokeDashoffset:0,duration:d,ease:'none',immediateRender:true},cursor);
   if(p.hasAttribute('data-glyph'))tl.to(p,{fillOpacity:1,duration:Math.min(.12,d)},cursor+d*.78);
   if(hand){
    const inverse=hand.parentNode.getCTM().inverse(),matrix=p.getCTM(),count=Math.min(200,Math.max(8,Math.ceil(n/16))),points=[];
    for(let j=0;j<=count;j++){const pt=p.getPointAtLength(n*j/count),v=board.createSVGPoint();v.x=pt.x;v.y=pt.y;const z=v.matrixTransform(matrix).matrixTransform(inverse);points.push({x:z.x,y:z.y});}
    tl.set(object(a.hand),{opacity:1},cursor);tl.set(hand,{x:points[0].x,y:points[0].y},cursor);
    tl.to(hand,{keyframes:points.slice(1).map(p=>({...p,duration:d/count,ease:'none'})),ease:'none'},cursor);
    trace.push({target:a.target,hand:a.hand,pathIndex:i,start:cursor,end:cursor+d,points});
   }
   cursor+=d;
  }
  for(const p of filled)tl.fromTo(p,{opacity:0},{opacity:1,duration:a.duration*.25,immediateRender:true},a.at+a.duration*.7);
  if(hand)tl.set(object(a.hand),{opacity:0},a.at+a.duration);
 }
 for(const a of [...story.actions].sort((x,y)=>x.at-y.at)){
  const target=a.type==='camera'?camera:motion(a.target);
  if(['draw','write','connect','hand-draw'].includes(a.type)){draw(a);continue;}
  if(a.type==='erase'){tl.to(object(a.target),{opacity:0,duration:a.duration,ease:'none'},a.at);continue;}
  if(a.type==='emphasize'){const target=root.querySelector('[data-emphasis="'+a.target+'"]'),amount=a.amount??1.08;tl.to(target,{scale:amount,transformOrigin:'50% 50%',duration:a.duration/2,ease:'sine.inOut'},a.at);tl.to(target,{scale:1,duration:a.duration/2,ease:'sine.inOut'},a.at+a.duration/2);continue;}
  const vars={};for(const k of ['x','y','scale','rotation'])if(a[k]!==undefined)vars[k]=a[k];
  tl.to(target,{...vars,duration:a.duration,ease:'power2.inOut'},a.at);
 }
 tl.to(camera,{outlineColor:'transparent',duration:.001},story.duration-.001);
 tl.__handTrace=trace;
 tl.seek(0,true);
 return tl;
}
