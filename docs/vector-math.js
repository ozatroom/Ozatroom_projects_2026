// OZATROOM BIM · Vector Mathematics v1
// World coordinates: metres. X/Y horizontal, Z vertical.
export const DEFAULT_TOLERANCE=1e-7;
const finite=n=>Number.isFinite(n);
export function assertPoint3(p){if(!p||![p.x,p.y,p.z??0].every(finite))throw new TypeError('Point3 requires finite x, y and z coordinates');return p}
export class Point3{
 constructor(x=0,y=0,z=0){if(![x,y,z].every(finite))throw new TypeError('Point3 coordinates must be finite');this.x=x;this.y=y;this.z=z}
 clone(){return new Point3(this.x,this.y,this.z)}
 distanceTo(p){assertPoint3(p);return Math.hypot(this.x-p.x,this.y-p.y,this.z-(p.z??0))}
 equals(p,tolerance=DEFAULT_TOLERANCE){return !!p&&this.distanceTo(p)<=tolerance}
 translated(v){return new Point3(this.x+v.x,this.y+v.y,this.z+v.z)}
 toArray(){return [this.x,this.y,this.z]}
 static from(v){return v instanceof Point3?v.clone():new Point3(v.x,v.y,v.z??0)}
}
export class Vector3{
 constructor(x=0,y=0,z=0){if(![x,y,z].every(finite))throw new TypeError('Vector3 components must be finite');this.x=x;this.y=y;this.z=z}
 add(v){return new Vector3(this.x+v.x,this.y+v.y,this.z+v.z)}
 subtract(v){return new Vector3(this.x-v.x,this.y-v.y,this.z-v.z)}
 scale(s){if(!finite(s))throw new TypeError('Scale must be finite');return new Vector3(this.x*s,this.y*s,this.z*s)}
 dot(v){return this.x*v.x+this.y*v.y+this.z*v.z}
 cross(v){return new Vector3(this.y*v.z-this.z*v.y,this.z*v.x-this.x*v.z,this.x*v.y-this.y*v.x)}
 get length(){return Math.hypot(this.x,this.y,this.z)}
 get lengthSquared(){return this.dot(this)}
 normalized(tolerance=DEFAULT_TOLERANCE){const l=this.length;if(l<=tolerance)throw new RangeError('Cannot normalize a zero-length vector');return this.scale(1/l)}
 angleTo(v,tolerance=DEFAULT_TOLERANCE){const d=this.length*v.length;if(d<=tolerance)throw new RangeError('Angle is undefined for zero-length vectors');return Math.acos(Math.max(-1,Math.min(1,this.dot(v)/d)))}
 isParallelTo(v,tolerance=DEFAULT_TOLERANCE){const d=this.length*v.length;if(d<=tolerance)return false;return this.cross(v).length<=tolerance*d}
 isPerpendicularTo(v,tolerance=DEFAULT_TOLERANCE){const d=this.length*v.length;return d>tolerance&&Math.abs(this.dot(v))<=tolerance*d}
 toArray(){return [this.x,this.y,this.z]}
 static between(a,b){assertPoint3(a);assertPoint3(b);return new Vector3(b.x-a.x,b.y-a.y,(b.z??0)-(a.z??0))}
}
export class Line3{
 constructor(start,end){this.start=Point3.from(start);this.end=Point3.from(end);if(this.start.equals(this.end))throw new RangeError('Line endpoints must be different')}
 get direction(){return Vector3.between(this.start,this.end).normalized()}
 get length(){return this.start.distanceTo(this.end)}
 pointAt(t){return this.start.translated(Vector3.between(this.start,this.end).scale(t))}
 closestPoint(p){const d=Vector3.between(this.start,this.end),den=d.lengthSquared,t=Math.max(0,Math.min(1,Vector3.between(this.start,p).dot(d)/den));return this.pointAt(t)}
 isParallelTo(line,tol=DEFAULT_TOLERANCE){return this.direction.isParallelTo(line.direction,tol)}
 isPerpendicularTo(line,tol=DEFAULT_TOLERANCE){return this.direction.isPerpendicularTo(line.direction,tol)}
 intersect2D(line,tol=DEFAULT_TOLERANCE){
  const x1=this.start.x,y1=this.start.y,x2=this.end.x,y2=this.end.y,x3=line.start.x,y3=line.start.y,x4=line.end.x,y4=line.end.y;
  const den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);if(Math.abs(den)<=tol)return null;
  const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/den,u=-((x1-x2)*(y1-y3)-(y1-y2)*(x1-x3))/den;
  if(t< -tol||t>1+tol||u< -tol||u>1+tol)return null;
  return new Point3(x1+t*(x2-x1),y1+t*(y2-y1),this.start.z+t*((this.end.z??0)-(this.start.z??0)));
 }
}
export class Plane3{
 constructor(point,normal){this.point=Point3.from(point);this.normal=Vector3.from?Vector3.from(normal):new Vector3(normal.x,normal.y,normal.z).normalized()}
 signedDistance(p){return Vector3.between(this.point,p).dot(this.normal)}
 project(p){const d=this.signedDistance(p);return Point3.from(p).translated(this.normal.scale(-d))}
 intersectLine(line,tol=DEFAULT_TOLERANCE){const d=Vector3.between(line.start,line.end),den=d.dot(this.normal);if(Math.abs(den)<=tol)return null;const t=Vector3.between(line.start,this.point).dot(this.normal)/den;if(t< -tol||t>1+tol)return null;return line.pointAt(t)}
}
