import { Point3, Vector3 } from './vector-math.js?v=20261118-01';
// OZATROOM BIM · Geometry Core v1.0
// Canonical topology model. Coordinates are stored in metres (X/Y horizontal, Z vertical).
// Rendering meshes are derived data and never replace this model.

const EPS = 1e-8;
const uid = (prefix='g') => prefix + '_' + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 12));
const clone = value => JSON.parse(JSON.stringify(value));
const distance3 = (a,b) => Point3.from(a).distanceTo(b);
const cross = (a,b) => new Vector3(a.x,a.y,a.z).cross(new Vector3(b.x,b.y,b.z));
const dot = (a,b) => new Vector3(a.x,a.y,a.z).dot(new Vector3(b.x,b.y,b.z));
const sub = (a,b) => Vector3.between(b,a);
const normalize = v => { const l=Math.hypot(v.x,v.y,v.z); return l>EPS?new Vector3(v.x,v.y,v.z).normalized():{x:0,y:0,z:0}; };
const keyPair = (a,b) => a<b ? a+'|'+b : b+'|'+a;

export class GeometryError extends Error {
  constructor(code,message,elementIds=[]){ super(message); this.name='GeometryError'; this.code=code; this.elementIds=elementIds; }
}

export class GeometryCore {
  constructor(data=null) {
    this.vertices=new Map(); this.edges=new Map(); this.faces=new Map(); this.solids=new Map();
    this.revision=0; this.history=[]; this.future=[];
    if(data) this.importData(data);
  }
  _touch(){ this.revision++; }
  _snapshot(){ return this.exportData(); }
  _transaction(fn) {
    const before=this._snapshot();
    try { const result=fn(); this._touch(); this.history.push(before); this.future.length=0; return result; }
    catch(error){ this.importData(before,{silent:true}); throw error; }
  }
  exportData(){
    const values=m=>Array.from(m.values()).map(clone);
    return {schema:'ozatroom.geometry',version:1,units:'m',revision:this.revision,vertices:values(this.vertices),edges:values(this.edges),faces:values(this.faces),solids:values(this.solids)};
  }
  importData(data,{silent=false}={}){
    if(!data || !Array.isArray(data.vertices)||!Array.isArray(data.edges)||!Array.isArray(data.faces)||!Array.isArray(data.solids)) throw new GeometryError('INVALID_DATA','Некорректный формат Geometry Core');
    this.vertices=new Map(data.vertices.map(v=>[v.id,clone(v)]));
    this.edges=new Map(data.edges.map(e=>[e.id,clone(e)]));
    this.faces=new Map(data.faces.map(f=>[f.id,clone(f)]));
    this.solids=new Map(data.solids.map(s=>[s.id,clone(s)]));
    if(!silent) this._touch();
    this._rebuildAdjacency();
    return this;
  }
  _rebuildAdjacency(){
    for(const v of this.vertices.values()){v.connectedEdges=[];v.connectedFaces=[];}
    for(const e of this.edges.values()){e.connectedFaces=[];const a=this.vertices.get(e.startVertexId),b=this.vertices.get(e.endVertexId);if(a)a.connectedEdges.push(e.id);if(b)b.connectedEdges.push(e.id);e.length=a&&b?distance3(a,b):0;}
    for(const f of this.faces.values()){
      for(const loop of [f.outerLoop,...(f.innerLoops||[])]){
        for(const eid of loop){const e=this.edges.get(eid);if(e&&!e.connectedFaces.includes(f.id))e.connectedFaces.push(f.id);}
        for(const vid of this._loopVertexIds(loop)){const v=this.vertices.get(vid);if(v&&!v.connectedFaces.includes(f.id))v.connectedFaces.push(f.id);}
      }
    }
  }
  _loopVertexIds(edgeIds){
    const out=[];for(const id of edgeIds){const e=this.edges.get(id);if(!e)continue;if(!out.includes(e.startVertexId))out.push(e.startVertexId);if(!out.includes(e.endVertexId))out.push(e.endVertexId);}return out;
  }
  createVertex(x,y,z=0,options={}) {
    if(![x,y,z].every(Number.isFinite)) throw new GeometryError('INVALID_COORDINATE','Координаты вершины должны быть числами');
    return this._transaction(()=>{const id=options.id||uid('v');if(this.vertices.has(id))throw new GeometryError('DUPLICATE_ID','ID вершины уже существует',[id]);const v={id,x,y,z,connectedEdges:[],connectedFaces:[],visible:options.visible!==false,locked:!!options.locked};this.vertices.set(id,v);return clone(v);});
  }
  createEdge(startVertexId,endVertexId,options={}) {
    return this._transaction(()=>{const a=this.vertices.get(startVertexId),b=this.vertices.get(endVertexId);if(!a||!b)throw new GeometryError('MISSING_VERTEX','Для ребра нужны существующие вершины',[startVertexId,endVertexId]);if(startVertexId===endVertexId||distance3(a,b)<=EPS)throw new GeometryError('ZERO_LENGTH_EDGE','Нельзя создать ребро нулевой длины',[startVertexId,endVertexId]);const k=keyPair(startVertexId,endVertexId);for(const e of this.edges.values())if(keyPair(e.startVertexId,e.endVertexId)===k)throw new GeometryError('DUPLICATE_EDGE','Такое ребро уже существует',[e.id]);const id=options.id||uid('e');const e={id,startVertexId,endVertexId,connectedFaces:[],length:distance3(a,b),visible:options.visible!==false,selected:false,locked:!!options.locked};this.edges.set(id,e);this._rebuildAdjacency();return clone(e);});
  }
  _resolveLoop(pointsOrIds){
    if(!Array.isArray(pointsOrIds)||pointsOrIds.length<3)throw new GeometryError('OPEN_OR_SHORT_LOOP','Контур должен содержать минимум три вершины');
    let ids=pointsOrIds.map(p=>typeof p==='string'?p:p.id);
    if(ids[0]===ids[ids.length-1])ids.pop();
    if(new Set(ids).size<3||new Set(ids).size!==ids.length)throw new GeometryError('DUPLICATE_LOOP_VERTEX','Контур содержит повторяющиеся вершины',ids);
    for(const id of ids)if(!this.vertices.has(id))throw new GeometryError('MISSING_VERTEX','В контуре есть неизвестная вершина',[id]);
    return ids;
  }
  _findEdge(a,b){for(const e of this.edges.values())if(keyPair(e.startVertexId,e.endVertexId)===keyPair(a,b))return e;return null;}
  _ensureLoopEdges(ids){
    const result=[];for(let i=0;i<ids.length;i++){const a=ids[i],b=ids[(i+1)%ids.length];let e=this._findEdge(a,b);if(!e){const id=uid('e'),va=this.vertices.get(a),vb=this.vertices.get(b);e={id,startVertexId:a,endVertexId:b,connectedFaces:[],length:distance3(va,vb),visible:true,selected:false,locked:false};this.edges.set(id,e);}result.push(e.id);}return result;
  }
  _polygonInfo(ids){
    const pts=ids.map(id=>this.vertices.get(id));const origin=pts[0];let normal={x:0,y:0,z:0};
    for(let i=1;i<pts.length-1;i++)normal=cross(sub(pts[i],origin),sub(pts[i+1],origin));
    normal=normalize(normal);if(Math.hypot(normal.x,normal.y,normal.z)<=EPS)throw new GeometryError('DEGENERATE_FACE','Поверхность вырождена',ids);
    const maxDist=Math.max(...pts.map(p=>Math.abs(dot(sub(p,origin),normal))));
    if(maxDist>1e-5)throw new GeometryError('NON_PLANAR_FACE','Вершины поверхности не лежат в одной плоскости',ids);
    const areaVec={x:0,y:0,z:0};for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];areaVec.x+=(a.y-b.y)*(a.z+b.z);areaVec.y+=(a.z-b.z)*(a.x+b.x);areaVec.z+=(a.x-b.x)*(a.y+b.y);}
    const area=Math.hypot(areaVec.x,areaVec.y,areaVec.z)/2;
    if(area<=EPS)throw new GeometryError('ZERO_AREA_FACE','Площадь поверхности равна нулю',ids);
    return {normal,area};
  }
  detectClosedLoops({maxLoops=2000}={}) {
    this._rebuildAdjacency();
    const adjacency=new Map([...this.vertices.keys()].map(id=>[id,[]]));
    for(const e of this.edges.values()){
      if(!adjacency.has(e.startVertexId)||!adjacency.has(e.endVertexId))continue;
      adjacency.get(e.startVertexId).push(e.endVertexId);
      adjacency.get(e.endVertexId).push(e.startVertexId);
    }
    for(const list of adjacency.values())list.sort();
    const canonical=ids=>{
      const min=Math.min(...ids.map((_,i)=>i));
      const rotations=[];
      for(let i=0;i<ids.length;i++)if(ids[i]===ids[min]){rotations.push(ids.slice(i).concat(ids.slice(0,i)));const rev=[...ids].reverse();const j=rev.indexOf(ids[min]);rotations.push(rev.slice(j).concat(rev.slice(0,j)));}
      rotations.sort((a,b)=>a.join('|').localeCompare(b.join('|')));
      return rotations[0];
    };
    const found=new Map(),ordered=[...adjacency.keys()].sort();
    for(const start of ordered){
      const path=[start],visited=new Set(path);
      const walk=current=>{
        if(found.size>=maxLoops)return;
        for(const next of adjacency.get(current)||[]){
          if(next===start&&path.length>=3){
            const loop=canonical(path),key=loop.join('|');
            if(!found.has(key)){
              let chord=false;
              for(let i=0;i<loop.length&&!chord;i++)for(let j=i+1;j<loop.length;j++){
                if(j===i+1||(i===0&&j===loop.length-1))continue;
                if(this._findEdge(loop[i],loop[j])){chord=true;break;}
              }
              if(!chord)found.set(key,loop);
            }
          }else if(next>start&&!visited.has(next)&&path.length<64){
            visited.add(next);path.push(next);walk(next);path.pop();visited.delete(next);
          }
          if(found.size>=maxLoops)return;
        }
      };
      walk(start);
      if(found.size>=maxLoops)break;
    }
    return [...found.values()].map(vertexIds=>({vertexIds,edgeIds:vertexIds.map((id,i)=>this._findEdge(id,vertexIds[(i+1)%vertexIds.length])?.id).filter(Boolean)}));
  }
  detectFaces({create=true,maxLoops=2000}={}) {
    const loops=this.detectClosedLoops({maxLoops}),existing=new Set();
    const signature=ids=>{const variants=[];for(let i=0;i<ids.length;i++){variants.push(ids.slice(i).concat(ids.slice(0,i)).join('|'));const r=[...ids].reverse();const j=r.indexOf(ids[i]);variants.push(r.slice(j).concat(r.slice(0,j)).join('|'));}return variants.sort()[0];};
    for(const face of this.faces.values()){
      const ids=this._loopVertexIds(face.outerLoop);if(ids.length>=3)existing.add(signature(ids));
    }
    const created=[],skipped=[],errors=[];
    for(const loop of loops){
      const key=signature(loop.vertexIds);
      if(existing.has(key)){skipped.push({vertexIds:loop.vertexIds,reason:'FACE_EXISTS'});continue;}
      if(!create){skipped.push({vertexIds:loop.vertexIds,reason:'PREVIEW_ONLY'});continue;}
      try{
        const face=this.createFace(loop.vertexIds);
        existing.add(key);created.push(face.id);
      }catch(error){errors.push({code:error.code||'FACE_DETECTION_ERROR',message:error.message,vertexIds:loop.vertexIds});}
    }
    return {loops:loops.length,created,skipped,errors,limited:loops.length>=maxLoops};
  }
  createFace(outerPoints,innerLoops=[],options={}) {
    return this._transaction(()=>{
      const outer=this._resolveLoop(outerPoints),holes=innerLoops.map(loop=>this._resolveLoop(loop));
      const info=this._polygonInfo(outer);
      for(const hole of holes){const h=this._polygonInfo(hole);if(Math.abs(Math.abs(dot(info.normal,h.normal))-1)>1e-5)throw new GeometryError('HOLE_NOT_COPLANAR','Внутренний контур не лежит в плоскости поверхности',hole);}
      const outerEdges=this._ensureLoopEdges(outer),innerEdges=holes.map(h=>this._ensureLoopEdges(h));
      const id=options.id||uid('f');const f={id,outerLoop:outerEdges,innerLoops:innerEdges,normal:info.normal,area:Math.max(0,info.area-holes.reduce((s,h)=>s+this._polygonInfo(h).area,0)),materialId:options.materialId||null,triangulation:[],visible:options.visible!==false,selected:false};
      this.faces.set(id,f);this._rebuildAdjacency();return clone(f);
    });
  }
  moveVertex(id,x,y,z) {
    return this._transaction(()=>{const v=this.vertices.get(id);if(!v)throw new GeometryError('MISSING_VERTEX','Вершина не найдена',[id]);if(v.locked)throw new GeometryError('LOCKED_VERTEX','Вершина заблокирована',[id]);if(![x,y,z].every(Number.isFinite))throw new GeometryError('INVALID_COORDINATE','Некорректные координаты',[id]);v.x=x;v.y=y;v.z=z;for(const fid of v.connectedFaces){const f=this.faces.get(fid),ids=this._loopVertexIds(f.outerLoop),info=this._polygonInfo(ids);f.normal=info.normal;f.area=Math.max(0,info.area-(f.innerLoops||[]).reduce((s,l)=>s+this._polygonInfo(this._loopVertexIds(l)).area,0));}this._rebuildAdjacency();return clone(v);});
  }
  splitEdge(edgeId,point) {
    return this._transaction(()=>{const e=this.edges.get(edgeId);if(!e)throw new GeometryError('MISSING_EDGE','Ребро не найдено',[edgeId]);const a=this.vertices.get(e.startVertexId),b=this.vertices.get(e.endVertexId);const id=uid('v'),v={id,x:point.x,y:point.y,z:point.z??0,connectedEdges:[],connectedFaces:[],visible:true,locked:false};const ab=sub(b,a),ap=sub(v,a),t=dot(ap,ab)/dot(ab,ab);if(t<=EPS||t>=1-EPS)throw new GeometryError('INVALID_SPLIT_POINT','Точка разделения должна находиться внутри ребра',[edgeId]);const faceIds=[...e.connectedFaces];this.vertices.set(id,v);this.edges.delete(edgeId);const e1={...e,id:uid('e'),endVertexId:id,connectedFaces:[]},e2={...e,id:uid('e'),startVertexId:id,connectedFaces:[]};this.edges.set(e1.id,e1);this.edges.set(e2.id,e2);for(const fid of faceIds){const f=this.faces.get(fid);for(const loop of [f.outerLoop,...f.innerLoops]){const i=loop.indexOf(edgeId);if(i>=0)loop.splice(i,1,e1.id,e2.id);}}this._rebuildAdjacency();return clone(v);});
  }
  mergeVertices(sourceId,targetId) {
    return this._transaction(()=>{if(sourceId===targetId)return clone(this.vertices.get(targetId));const src=this.vertices.get(sourceId),dst=this.vertices.get(targetId);if(!src||!dst)throw new GeometryError('MISSING_VERTEX','Вершина для объединения не найдена',[sourceId,targetId]);if(src.locked)throw new GeometryError('LOCKED_VERTEX','Исходная вершина заблокирована',[sourceId]);for(const e of this.edges.values()){if(e.startVertexId===sourceId)e.startVertexId=targetId;if(e.endVertexId===sourceId)e.endVertexId=targetId;}for(const e of [...this.edges.values()])if(e.startVertexId===e.endVertexId)this.edges.delete(e.id);this.vertices.delete(sourceId);for(const f of this.faces.values()){for(const loop of [f.outerLoop,...f.innerLoops]){for(let i=loop.length-1;i>=0;i--){const e=this.edges.get(loop[i]);if(!e){loop.splice(i,1);continue;}if(e.startVertexId===targetId&&e.endVertexId===targetId)loop.splice(i,1);}}}this._rebuildAdjacency();return clone(dst);});
  }
  deleteGeometry(ids) {
    return this._transaction(()=>{const set=new Set(Array.isArray(ids)?ids:[ids]);for(const id of set){if(this.faces.has(id)){this.faces.delete(id);continue;}if(this.edges.has(id)){const e=this.edges.get(id);for(const fid of e.connectedFaces)this.faces.delete(fid);this.edges.delete(id);continue;}if(this.vertices.has(id)){const v=this.vertices.get(id);for(const fid of v.connectedFaces)this.faces.delete(fid);for(const eid of v.connectedEdges)this.edges.delete(eid);this.vertices.delete(id);continue;}this.solids.delete(id);}this._rebuildAdjacency();return true;});
  }
  findAdjacentFaces(faceId){const f=this.faces.get(faceId);if(!f)return[];const ids=new Set([...f.outerLoop,...f.innerLoops.flat()]);return [...new Set([...ids].flatMap(id=>this.edges.get(id)?.connectedFaces||[]))].filter(id=>id!==faceId);}
  rebuild(){this._rebuildAdjacency();return this.validateGeometry();}
  validateGeometry(){
    const errors=[],warnings=[],invalid=new Set(),add=(code,message,ids=[])=>{errors.push({code,message,elementIds:ids});ids.forEach(id=>invalid.add(id));};
    const seenEdges=new Map();
    for(const e of this.edges.values()){const a=this.vertices.get(e.startVertexId),b=this.vertices.get(e.endVertexId);if(!a||!b)add('MISSING_VERTEX_REF','Ребро ссылается на отсутствующую вершину',[e.id]);else if(distance3(a,b)<=EPS)add('ZERO_LENGTH_EDGE','Ребро имеет нулевую длину',[e.id]);const k=keyPair(e.startVertexId,e.endVertexId);if(seenEdges.has(k))add('DUPLICATE_EDGE','Обнаружены дублирующиеся рёбра',[seenEdges.get(k),e.id]);else seenEdges.set(k,e.id);}
    for(const f of this.faces.values()){try{const ids=this._loopVertexIds(f.outerLoop);if(ids.length<3)add('OPEN_FACE_LOOP','Недостаточно вершин в контуре грани',[f.id]);else{const info=this._polygonInfo(ids);if(!Number.isFinite(f.area)||f.area<=EPS)add('INVALID_FACE_AREA','Некорректная площадь грани',[f.id]);if(dot(info.normal,f.normal)<.999)add('INVALID_NORMAL','Нормаль грани не соответствует геометрии',[f.id]);}for(const loop of [f.outerLoop,...f.innerLoops])for(const eid of loop)if(!this.edges.has(eid))add('MISSING_EDGE_REF','Грань ссылается на отсутствующее ребро',[f.id,eid]);}catch(err){add(err.code||'INVALID_FACE',err.message,[f.id,...(err.elementIds||[])]);}}
    for(const s of this.solids.values()){for(const fid of s.faceIds)if(!this.faces.has(fid))add('MISSING_FACE_REF','Тело ссылается на отсутствующую грань',[s.id,fid]);const counts=new Map();for(const fid of s.faceIds){const f=this.faces.get(fid);if(!f)continue;for(const eid of f.outerLoop)counts.set(eid,(counts.get(eid)||0)+1);}const closed=[...counts.values()].every(v=>v===2);s.isClosed=closed;s.isManifold=closed;if(!closed)add('OPEN_SOLID','Объёмное тело не является замкнутым',[s.id]);}
    return {isValid:errors.length===0,errors,warnings,invalidElementIds:[...invalid]};
  }
  undo(){if(!this.history.length)return false;this.future.push(this._snapshot());const prev=this.history.pop();this.importData(prev);return true;}
  redo(){if(!this.future.length)return false;this.history.push(this._snapshot());const next=this.future.pop();this.importData(next);return true;}
}

export function createGeometryCore(data){return new GeometryCore(data);}
