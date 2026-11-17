import { SnapEngine } from './snap-engine.js';
const test=(name,fn)=>{try{fn();return{name,passed:true}}catch(e){return{name,passed:false,error:e.message}}};
const eq=(a,b,t=1e-8)=>{if(Math.abs(a-b)>t)throw new Error(`Expected ${a} ≈ ${b}`)};
export function runSnapEngineTests(){
 const snap=new SnapEngine({pixelTolerance:10,gridSize:1});
 const results=[
 test('endpoint priority',()=>{const r=snap.snap({x:.02,y:.01},{points:[{x:0,y:0}],scale:100,segments:[]});if(r.type!=='endpoint')throw Error(r.type);eq(r.point.x,0)}),
 test('midpoint',()=>{const r=snap.snap({x:5,y:.02},{segments:[{a:{x:0,y:0},b:{x:10,y:0}}],scale:1,gridSize:0});if(r.type!=='midpoint')throw Error(r.type);eq(r.point.x,5)}),
 test('circle center',()=>{const r=snap.snap({x:2,y:3},{circles:[{center:{x:2,y:3}}],scale:10});if(r.type!=='center')throw Error(r.type)}),
 test('segment intersection',()=>{const segments=[{a:{x:0,y:0},b:{x:2,y:2}},{a:{x:0,y:2},b:{x:2,y:0}}];const r=snap.snap({x:1,y:1},{segments,scale:10,gridSize:0});if(r.type!=='intersection')throw Error(r.type);eq(r.point.x,1);eq(r.point.y,1)}),
 test('nearest point on segment',()=>{const r=snap.snap({x:4,y:.04},{segments:[{a:{x:0,y:0},b:{x:10,y:0}}],scale:10,gridSize:0,modes:{midpoint:false}});if(!['perpendicular','nearest'].includes(r.type))throw Error(r.type);eq(r.point.x,4);eq(r.point.y,0)}),
 test('grid fallback',()=>{const r=snap.snap({x:1.04,y:2.02},{scale:100,points:[],segments:[],gridSize:.1});if(r.type!=='grid')throw Error(r.type);eq(r.point.x,1);eq(r.point.y,2)}),
 test('pixel tolerance scales with zoom',()=>{const near=snap.snap({x:.05,y:0},{points:[{x:0,y:0}],scale:100,segments:[],gridSize:0});if(near.type!=='endpoint')throw Error(near.type);const far=snap.snap({x:.05,y:0},{points:[{x:0,y:0}],scale:1000,segments:[],gridSize:0});if(far.type!=='none')throw Error(far.type)}),
 test('disabled returns original point',()=>{const r=snap.snap({x:.13,y:.27},{enabled:false,scale:100});if(r.type!=='none')throw Error(r.type);eq(r.point.x,.13);eq(r.point.y,.27)})
 ];return{passed:results.filter(x=>x.passed).length,total:results.length,results};
}
