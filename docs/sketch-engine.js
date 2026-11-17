import { Point3, Vector3, Line3, DEFAULT_TOLERANCE } from './vector-math.js?v=20261118-01';

const clonePoint = p => new Point3(p.x, p.y ?? 0, p.z ?? 0);
const distance2 = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const uid = () => 'sk_' + Math.random().toString(36).slice(2,10);
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y ?? 0) && Number.isFinite(p.z ?? 0);

export class SketchEngine {
  constructor({tolerance=DEFAULT_TOLERANCE, plane='XY'}={}) {
    this.tolerance=tolerance; this.plane=plane; this.entities=new Map(); this.revision=0;
  }
  _add(type,data) {
    const entity={id:data.id||uid(),type,...data};
    if(this.entities.has(entity.id)) throw new Error('Duplicate sketch entity id: '+entity.id);
    this.entities.set(entity.id,entity); this.revision++; return entity;
  }
  get(id){return this.entities.get(id)||null}
  list(){return [...this.entities.values()]}
  delete(id){const ok=this.entities.delete(id);if(ok)this.revision++;return ok}
  clear(){if(this.entities.size){this.entities.clear();this.revision++}}
  addLine(start,end,options={}) {
    if(!finitePoint(start)||!finitePoint(end)) throw new TypeError('Line points must be finite');
    if(distance2(start,end)<=this.tolerance) throw new RangeError('Line length is below tolerance');
    return this._add('line',{start:clonePoint(start),end:clonePoint(end),construction:!!options.construction,closed:false});
  }
  addPolyline(points,{closed=false,construction=false}={}) {
    if(!Array.isArray(points)||points.length<(closed?3:2)||points.some(p=>!finitePoint(p))) throw new TypeError('Polyline requires valid points');
    const pts=points.map(clonePoint);
    for(let i=1;i<pts.length;i++) if(distance2(pts[i-1],pts[i])<=this.tolerance) throw new RangeError('Polyline contains a zero-length segment');
    if(closed&&distance2(pts[0],pts[pts.length-1])<=this.tolerance) pts.pop();
    if(closed&&pts.length<3) throw new RangeError('Closed polygon requires at least 3 distinct points');
    return this._add('polyline',{points:pts,closed:!!closed,construction:!!construction});
  }
  addRectangle(a,b,options={}) {
    if(!finitePoint(a)||!finitePoint(b)) throw new TypeError('Rectangle corners must be finite');
    const x1=Math.min(a.x,b.x),x2=Math.max(a.x,b.x),y1=Math.min(a.y,b.y),y2=Math.max(a.y,b.y);
    if(x2-x1<=this.tolerance||y2-y1<=this.tolerance) throw new RangeError('Rectangle dimensions are below tolerance');
    return this.addPolyline([{x:x1,y:y1},{x:x2,y:y1},{x:x2,y:y2},{x:x1,y:y2}],{closed:true,...options});
  }
  addCircle(center,radius,options={}) {
    if(!finitePoint(center)||!Number.isFinite(radius)||radius<=this.tolerance) throw new RangeError('Circle radius must be greater than tolerance');
    return this._add('circle',{center:clonePoint(center),radius,construction:!!options.construction});
  }
  addArc(center,radius,startAngle,endAngle,options={}) {
    if(!finitePoint(center)||!Number.isFinite(radius)||radius<=this.tolerance||!Number.isFinite(startAngle)||!Number.isFinite(endAngle)) throw new TypeError('Invalid arc parameters');
    let sweep=endAngle-startAngle;while(sweep<0)sweep+=Math.PI*2;
    if(sweep<=this.tolerance||sweep>=Math.PI*2-this.tolerance) throw new RangeError('Arc sweep must be between 0 and 2π');
    return this._add('arc',{center:clonePoint(center),radius,startAngle,endAngle:startAngle+sweep,construction:!!options.construction});
  }
  addPolygon(points,options={}) {
    const entity=this.addPolyline(points,{closed:true,...options});
    const validation=this.validate(entity.id);
    if(!validation.valid){this.entities.delete(entity.id);this.revision++;throw new RangeError('Invalid polygon: '+validation.errors.join('; '))}
    entity.type='polygon';return entity;
  }
  pointsOf(entity){return entity?.type==='line'?[entity.start,entity.end]:['polyline','polygon'].includes(entity?.type)?entity.points:[]}
  signedArea(entityOrPoints) {
    const pts=Array.isArray(entityOrPoints)?entityOrPoints:this.pointsOf(entityOrPoints);
    if(pts.length<3)return 0;let sum=0;
    for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];sum+=a.x*b.y-b.x*a.y}
    return sum/2;
  }
  validate(id) {
    const e=this.get(id);if(!e)return{valid:false,errors:['Entity not found']};
    const errors=[];
    if(e.type==='polygon'||(e.type==='polyline'&&e.closed)){
      const pts=e.points,n=pts.length;
      if(n<3)errors.push('At least 3 vertices are required');
      if(Math.abs(this.signedArea(pts))<=this.tolerance)errors.push('Area is below tolerance');
      for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
        if(j===i||j===(i+1)%n||i===(j+1)%n)continue;
        if(segmentsIntersect(pts[i],pts[(i+1)%n],pts[j],pts[(j+1)%n],this.tolerance))errors.push('Self-intersection between segments '+i+' and '+j);
      }
    }
    return{valid:errors.length===0,errors};
  }
  move(id,dx,dy,dz=0) {
    const e=this.get(id);if(!e||![dx,dy,dz].every(Number.isFinite))return false;
    if(e.type==='line'){e.start=e.start.translated(new Vector3(dx,dy,dz));e.end=e.end.translated(new Vector3(dx,dy,dz))}
    else if(['polyline','polygon'].includes(e.type))e.points=e.points.map(p=>p.translated(new Vector3(dx,dy,dz)));
    else if(e.center)e.center=e.center.translated(new Vector3(dx,dy,dz));
    else return false;
    this.revision++;return true;
  }
  rotate(id,angle,origin={x:0,y:0,z:0}) {
    const e=this.get(id);if(!e||!Number.isFinite(angle)||!finitePoint(origin))return false;
    const rotate=p=>{const x=p.x-origin.x,y=p.y-origin.y,c=Math.cos(angle),s=Math.sin(angle);return new Point3(origin.x+x*c-y*s,origin.y+x*s+y*c,p.z)};
    if(e.type==='line'){e.start=rotate(e.start);e.end=rotate(e.end)}
    else if(['polyline','polygon'].includes(e.type))e.points=e.points.map(rotate);
    else if(e.center)e.center=rotate(e.center);
    else return false;
    if(e.type==='arc'){e.startAngle+=angle;e.endAngle+=angle}
    this.revision++;return true;
  }
  offsetPolyline(id,distance) {
    const e=this.get(id);if(!e||!['polyline','polygon'].includes(e.type)||!Number.isFinite(distance)||e.points.length<2)return null;
    const pts=e.points,n=pts.length,closed=e.closed,shifted=[];
    for(let i=0;i<(closed?n:n-1);i++){
      const a=pts[i],b=pts[(i+1)%n],dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy);
      if(l<=this.tolerance)return null;
      const sign=this.signedArea(pts)>=0?1:-1;
      shifted.push({a:{x:a.x+dy/l*distance*sign,y:a.y-dx/l*distance*sign},b:{x:b.x+dy/l*distance*sign,y:b.y-dx/l*distance*sign}});
    }
    const out=[];
    for(let i=0;i<shifted.length;i++){
      const prev=shifted[(i-1+shifted.length)%shifted.length],cur=shifted[i];
      if(!closed&&i===0){out.push(prev?prev.b:cur.a);continue}
      const hit=lineIntersection(prev.a,prev.b,cur.a,cur.b,this.tolerance);
      out.push(hit||cur.a);
    }
    if(!closed)out.push(shifted[shifted.length-1].b);
    return this.addPolyline(out,{closed,construction:e.construction});
  }
  splitLine(id,point) {
    const e=this.get(id);if(!e||e.type!=='line'||!finitePoint(point))return null;
    const line=new Line3(e.start,e.end),q=line.closestPoint(point);
    if(distance2(q,point)>this.tolerance||distance2(q,e.start)<=this.tolerance||distance2(q,e.end)<=this.tolerance)return null;
    const first=this.addLine(e.start,q,{construction:e.construction}),second=this.addLine(q,e.end,{construction:e.construction});
    this.delete(id);return[first,second];
  }
  exportData(){return{version:1,plane:this.plane,tolerance:this.tolerance,entities:this.list().map(e=>JSON.parse(JSON.stringify(e)))}}
  importData(data){if(!data||data.version!==1||!Array.isArray(data.entities))throw new TypeError('Unsupported sketch data');const next=new Map();for(const e of data.entities){if(!e?.id||next.has(e.id))throw new Error('Invalid or duplicate sketch entity');next.set(e.id,reviveEntity(e))}this.entities=next;this.plane=data.plane||'XY';this.tolerance=Number.isFinite(data.tolerance)?data.tolerance:DEFAULT_TOLERANCE;this.revision++}
}
function reviveEntity(e){const c={...e};if(e.start)c.start=clonePoint(e.start);if(e.end)c.end=clonePoint(e.end);if(e.center)c.center=clonePoint(e.center);if(e.points)c.points=e.points.map(clonePoint);return c}
function orient(a,b,c){return(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)}
function onSegment(a,b,p,t){return Math.abs(orient(a,b,p))<=t&&p.x>=Math.min(a.x,b.x)-t&&p.x<=Math.max(a.x,b.x)+t&&p.y>=Math.min(a.y,b.y)-t&&p.y<=Math.max(a.y,b.y)+t}
function segmentsIntersect(a,b,c,d,t){const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);if(((o1>t&&o2< -t)||(o1< -t&&o2>t))&&((o3>t&&o4< -t)||(o3< -t&&o4>t)))return true;return onSegment(a,b,c,t)||onSegment(a,b,d,t)||onSegment(c,d,a,t)||onSegment(c,d,b,t)}
function lineIntersection(a,b,c,d,t){const x1=a.x,y1=a.y,x2=b.x,y2=b.y,x3=c.x,y3=c.y,x4=d.x,y4=d.y,den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);if(Math.abs(den)<=t)return null;return{x:((x1*y2-y1*x2)*(x3-x4)-(x1-x2)*(x3*y4-y3*x4))/den,y:((x1*y2-y1*x2)*(y3-y4)-(y1-y2)*(x3*y4-y3*x4))/den}}
