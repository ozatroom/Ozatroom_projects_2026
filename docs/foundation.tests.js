import {Point3,Vector3,Line3,Plane3} from './vector-math.js';
import {CoordinateSystem} from './coordinate-system.js';
export function runFoundationTests(){
 const results=[];const test=(name,fn)=>{try{fn();results.push({name,passed:true})}catch(e){results.push({name,passed:false,error:e.message})}};
 const near=(a,b,t=1e-8)=>{if(Math.abs(a-b)>t)throw Error(a+' != '+b)};
 test('Point distance',()=>near(new Point3(0,0,0).distanceTo(new Point3(3,4,0)),5));
 test('Point tolerance equality',()=>{if(!new Point3(1,2,3).equals(new Point3(1+1e-9,2,3)))throw Error('Tolerance equality failed')});
 test('Vector addition/subtraction',()=>{const v=new Vector3(1,2,3).add(new Vector3(2,1,0)).subtract(new Vector3(1,1,1));if(v.toArray().join(',')!=='2,2,2')throw Error('Vector arithmetic failed')});
 test('Dot and cross products',()=>{const a=new Vector3(1,0,0),b=new Vector3(0,1,0);near(a.dot(b),0);if(a.cross(b).toArray().join(',')!=='0,0,1')throw Error('Cross product failed')});
 test('Vector normalize and length',()=>{const v=new Vector3(3,0,4);near(v.length,5);near(v.normalized().length,1)});
 test('Vector angle',()=>near(new Vector3(1,0,0).angleTo(new Vector3(0,1,0)),Math.PI/2));
 test('Parallel and perpendicular',()=>{if(!new Vector3(2,0,0).isParallelTo(new Vector3(-1,0,0))||!new Vector3(1,0,0).isPerpendicularTo(new Vector3(0,2,0)))throw Error('Direction test failed')});
 test('Line length and point at',()=>{const l=new Line3(new Point3(0,0),new Point3(4,0));near(l.length,4);near(l.pointAt(.25).x,1)});
 test('Line segment intersection',()=>{const a=new Line3(new Point3(0,0),new Point3(2,2)),b=new Line3(new Point3(0,2),new Point3(2,0)),p=a.intersect2D(b);if(!p)throw Error('No intersection');near(p.x,1);near(p.y,1)});
 test('Plane projection and line intersection',()=>{const p=new Plane3(new Point3(0,0,2),new Vector3(0,0,1)),q=p.project(new Point3(1,2,5));near(q.z,2);const hit=p.intersectLine(new Line3(new Point3(0,0,0),new Point3(0,0,4)));near(hit.z,2)});
 test('Unit conversion',()=>{const c=new CoordinateSystem({displayUnit:'mm'});near(c.toMetres(1250),1.25);near(c.fromMetres(1.25),1250)});
 test('Display unit switching preserves storage values',()=>{const c=new CoordinateSystem();const v=2;c.setDisplayUnit('cm');near(c.display(v),200)});
 return {passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,results};
}