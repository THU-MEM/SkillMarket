// A free end, not a pinned endpoint. Phase travels from handle to tip.
// This is a teaching motion metaphor, not an inextensible-rope simulation.
export function whipPoints(t){
 return Array.from({length:33},(_,i)=>{
  const u=i/32,phase=2*Math.PI*(t/2.15-u),amp=8*u+217*u**1.65;
  return {x:419+853*u-24*u**3*(1-Math.cos(phase)),y:498+60*u+amp*Math.sin(phase)};
 });
}
const f=n=>n.toFixed(2);
export function whipPath(t){
 const p=whipPoints(t);let d=`M ${f(p[0].x)} ${f(p[0].y)}`;
 for(let i=0;i<p.length-1;i++){
  const a=p[Math.max(0,i-1)],b=p[i],c=p[i+1],z=p[Math.min(p.length-1,i+2)];
  d+=` C ${f(b.x+(c.x-a.x)/6)} ${f(b.y+(c.y-a.y)/6)} ${f(c.x-(z.x-b.x)/6)} ${f(c.y-(z.y-b.y)/6)} ${f(c.x)} ${f(c.y)}`;
 }return d;
}
export function buildWhipMotion(start,end){
 const count=Math.ceil((end-start)*24),step=(end-start)/count;
 const frames=Array.from({length:count+1},(_,i)=>({at:i===count?end:start+i*step,d:whipPath(i*step),tip:whipPoints(i*step).at(-1)}));
 const keys=frames.slice(1).map(f=>({attr:{d:f.d},duration:step,ease:'none'}));
 return {initial:frames[0].d,frames,proof:{start,end,tipRangeY:Math.max(...frames.map(f=>f.tip.y))-Math.min(...frames.map(f=>f.tip.y)),frameCount:frames.length},runtime:`tl.set('#whip-line',{strokeDasharray:'none',strokeDashoffset:0,attr:{d:${JSON.stringify(frames[0].d)}}},${start});tl.to('#whip-line',{keyframes:${JSON.stringify(keys)},ease:'none'},${start});`};
}
