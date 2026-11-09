// Card-only perspective motion. Outer anchors preserve the SVG layout transforms;
// inner solids own 3D rotation/depth so unrelated actors and timing stay untouched.
export function card3D({html,moves,schedule}) {
  const cards=[
    {id:'concept-card',src:'concept.png',x:557,y:270,w:326,h:527,roll:0,side:-1},
    {id:'end-concept',src:'concept.png',x:81,y:326,w:260,h:420,roll:-5,side:-1},
    {id:'end-application',src:'application.png',x:1099,y:326,w:260,h:420,roll:5,side:1},
  ];
  const ids=new Set(cards.map(c=>c.id));
  const svg=html.filter(h=>!cards.some(c=>h.startsWith(`<g id="${c.id}" `))).join('\n');
  const overlays=cards.map(c=>`<div id="${c.id}" class="card-anchor"><div class="card-perspective" style="left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px"><div id="${c.id}-solid" class="card-solid">${[-2,-1,0,1].map(z=>`<span class="card-edge" style="transform:translateZ(${z}px)"></span>`).join('')}<img class="card-front" src="assets/${c.src}" alt=""/><span class="card-back"></span></div></div></div>`).join('');
  const entry=schedule.find(e=>e.id==='concept-card').at;
  const exit=moves.find(m=>m.id==='concept-card'&&m.vars.opacity===0);
  if(!exit)throw Error('Card exit cue missing');
  const exitAt=exit.at,exitDuration=exit.duration;
  const adjusted=moves.filter(m=>!(m.id==='concept-card'&&(m.at===entry||m===exit))).map(m=>{
    if(!ids.has(m.id)||!m.vars.attr)return m;
    const match=m.vars.attr.transform.match(/^matrix\(([^)]+)\)$/);
    if(!match)throw Error('Unsupported card anchor transform');
    const [a,b,c,d,x,y]=match[1].split(/\s+/).map(Number);
    if(b||c||a!==d)throw Error('Expected uniform card anchor scale');
    return {...m,vars:{x,y,scale:a,transformOrigin:'0 0',ease:'power3.inOut'}};
  });
  adjusted.push({id:'concept-card',at:exitAt+exitDuration-.1,duration:.1,vars:{opacity:0,ease:'power2.in'}});
  const css=`.card-anchor{position:absolute;inset:0;opacity:0;pointer-events:none;transform-origin:0 0;will-change:transform}.card-perspective{position:absolute;perspective:1200px;perspective-origin:50% 50%;overflow:visible}.card-solid{position:absolute;inset:0;transform-style:preserve-3d;transform-origin:50% 50%}.card-front,.card-back,.card-edge{position:absolute;inset:0;width:100%;height:100%;display:block}.card-front{object-fit:fill;transform:translateZ(2px);backface-visibility:hidden}.card-back{background:#292035;border:2px solid #a89063;transform:rotateY(180deg) translateZ(2px);backface-visibility:hidden}.card-edge{background:#bca881;border:1px solid #74634d}`;
  const runtime=cards.map(c=>{
    const at=schedule.find(e=>e.id===c.id).at;
    return `tl.fromTo('#${c.id}-solid',{x:${c.side*145},y:155,z:-580,rotationX:18,rotationY:${c.side*106},rotationZ:${c.roll-c.side*14}},{x:0,y:0,z:32,rotationX:-3,rotationY:${-c.side*9},rotationZ:${c.roll},duration:.63,ease:'power2.out',immediateRender:false},${at});tl.to('#${c.id}-solid',{z:0,rotationX:0,rotationY:0,duration:.25,ease:'sine.inOut'},${at+.63});`;
  }).join('\n')+`tl.to('#concept-card-solid',{x:-120,y:-145,z:-620,rotationX:-16,rotationY:112,rotationZ:14,duration:${exitDuration},ease:'power2.in'},${exitAt});`;
  return {svg,overlays,css,runtime,moves:adjusted,proof:{entry,exitAt,exitDuration,cards:cards.map(c=>({id:c.id,at:schedule.find(e=>e.id===c.id).at}))}};
}
