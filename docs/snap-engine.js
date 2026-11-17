// OZATROOM BIM · Snap Engine V1.0
// Deterministic 2D object snaps in world coordinates, with pixel-sized capture radius.
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const project=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;if(l===0)return{x:a.x,y:a.y,t:0};const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l));return{x:a.x+t*dx,y:a.y+t*dy,t}};
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const intersection=(a,b,c,d,tol)=>{const den=(a.x-b.x)*(c.y-d.y)-(a.y-b.y)*(c.x-d.x);if(Math.abs(den)<=tol)return null;const t=((a.x-c.x)*(c.y-d.y)-(a.y-c.y)*(c.x-d.x))/den,u=-((a.x-b.x)*(a.y-c.y)-(a.y-b.y)*(a.x-c.x))/den;if(t< -tol||t>1+tol||u< -tol||u>1+tol)return null;return{x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)}};
export class SnapEngine{
 constructor({pixelTolerance=12,gridSize=.1}={}){this.pixelTolerance=pixelTolerance;this.gridSize=gridSize;this.enabled=true;this.modes={endpoint:true,midpoint:true,center:true,intersection:true,perpendicular:true,nearest:true,grid:true};}
 configure(options={}){if(Number.isFinite(options.pixelTolerance))this.pixelTolerance=Math.max(2,options.pixelTolerance);if(Number.isFinite(options.gridSize)&&options.gridSize>0)this.gridSize=options.gridSize;if(typeof options.enabled==='boolean')this.enabled=options.enabled;if(options.modes)this.modes={...this.modes,...options.modes};return this;}
 snap(point,{points=[],segments=[],circles=[],scale=1,enabled=this.enabled,gridSize=this.gridSize}={}){
  const raw={x:Number(point.x),y:Number(point.y)};if(!Number.isFinite(raw.x)||!Number.isFinite(raw.y))throw new TypeError('Snap point must contain finite coordinates');
  if(!enabled)return{point:raw,type:'none',target:null,distancePx:Infinity};
  const radius=this.pixelTolerance/Math.max(scale,1e-9);let best=null;
  const offer=(p,type,target)=>{if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return;const d=dist(raw,p)*scale;if(d<=this.pixelTolerance&&(!best||d<best.distancePx||(d===best.distancePx&&this._priority(type)<this._priority(best.type))))best={point:{x:p.x,y:p.y},type,target,distancePx:d}};
  if(this.modes.endpoint)for(const p of points)offer(p.point||p,'endpoint',p.id||null);
  if(this.modes.midpoint)for(const s of segments)offer({x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2},'midpoint',s.id||null);
  if(this.modes.center)for(const c of circles)offer(c.center||c,'center',c.id||null);
  if(this.modes.intersection){for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){const p=intersection(segments[i].a,segments[i].b,segments[j].a,segments[j].b,1e-9);if(p)offer(p,'intersection',[segments[i].id,segments[j].id])}}
  if(this.modes.perpendicular)for(const s of segments){const p=project(raw,s.a,s.b);if(p.t>1e-8&&p.t<1-1e-8)offer(p,'perpendicular',s.id||null)}
  if(this.modes.nearest)for(const s of segments){const p=project(raw,s.a,s.b);offer(p,'nearest',s.id||null)}
  if(this.modes.grid&&gridSize>0){const p={x:Math.round(raw.x/gridSize)*gridSize,y:Math.round(raw.y/gridSize)*gridSize};offer(p,'grid',null)}
  return best||{point:raw,type:'none',target:null,distancePx:Infinity};
 }
 _priority(type){return({endpoint:0,intersection:1,midpoint:2,center:3,perpendicular:4,nearest:5,grid:6})[type]??99}
}
