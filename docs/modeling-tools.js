// OZATROOM BIM · Modeling Tools
// Parametric modeling operations kept separate from the UI layer.
export function createModelingTools({getWalls,getRooms}={}){
 const walls=()=>typeof getWalls==='function'?getWalls():[];
 const rooms=()=>typeof getRooms==='function'?getRooms():[];
 const result=(ok,error=null,value=null)=>({ok,error,value});
 const valid=(v)=>Number.isFinite(v);
 function wallByFace(faceId){return walls().find(w=>faceId==='wall_'+w.id+'_face'||faceId==='wall_'+w.id+'_back_face')||null}
 function roomByFace(faceId){return rooms().find(r=>faceId==='room_'+r.id+'_floor')||null}
 function moveFace(faceId,dx=0,dy=0,newLength=null,newWidth=null,newDepth=null){
  if(!valid(dx)||!valid(dy))return result(false,'Смещение должно быть числом');
  const w=wallByFace(faceId);
  if(w){
   const old=Math.hypot(w.b.x-w.a.x,w.b.y-w.a.y),target=newLength==null?old:Number(newLength);
   if(!valid(target)||target<=.05)return result(false,'Длина стены должна быть больше 0.05 м');
   const ux=(w.b.x-w.a.x)/(old||1),uy=(w.b.y-w.a.y)/(old||1);
   w.a.x+=dx;w.a.y+=dy;w.b.x=w.a.x+ux*target;w.b.y=w.a.y+uy*target;
   return result(true,null,w);
  }
  const r=roomByFace(faceId);
  if(r){
   const width=newWidth==null?Math.abs(r.b.x-r.a.x):Number(newWidth),depth=newDepth==null?Math.abs(r.b.y-r.a.y):Number(newDepth);
   if(!valid(width)||!valid(depth)||width<=.05||depth<=.05)return result(false,'Размеры помещения должны быть больше 0.05 м');
   const sx=Math.sign(r.b.x-r.a.x)||1,sy=Math.sign(r.b.y-r.a.y)||1;
   r.a.x+=dx;r.a.y+=dy;r.b.x=r.a.x+sx*width;r.b.y=r.a.y+sy*depth;
   return result(true,null,r);
  }
  return result(false,'Для этой грани пока нет параметрического объекта');
 }
 function moveVertex(vertexId,x,y){
  if(!valid(x)||!valid(y))return result(false,'Введите корректные координаты');
  const wm=String(vertexId).match(/^wall_(.+)_(a|b)[01]$/);
  if(wm){const w=walls().find(item=>item.id===wm[1]);if(!w)return result(false,'Стена не найдена');const end=wm[2];w[end].x=x;w[end].y=y;return result(true,null,w)}
  const rm=String(vertexId).match(/^room_(.+)_([0-3])$/);
  if(rm){
   const r=rooms().find(item=>item.id===rm[1]);if(!r)return result(false,'Помещение не найдено');
   const corner=Number(rm[2]),right=corner===1||corner===2,bottom=corner>=2;
   const old={a:{...r.a},b:{...r.b}};
   if(right)r.b.x=x;else r.a.x=x;if(bottom)r.b.y=y;else r.a.y=y;
   if(Math.abs(r.b.x-r.a.x)<=.05||Math.abs(r.b.y-r.a.y)<=.05){r.a=old.a;r.b=old.b;return result(false,'Размер помещения должен быть больше 0.05 м')}
   return result(true,null,r);
  }
  return result(false,'Эта вершина пока не связана с параметрическим объектом');
 }
 function splitWall(wallId,t=.5){
  const w=walls().find(item=>item.id===wallId);
  if(!w)return result(false,'Стена не найдена');
  if(!valid(t)||t<=.02||t>=.98)return result(false,'Точка разделения должна быть внутри ребра');
  const mid={x:w.a.x+(w.b.x-w.a.x)*t,y:w.a.y+(w.b.y-w.a.y)*t};
  const second={...w,id:(globalThis.crypto?.randomUUID?.()||('wall_'+Date.now().toString(36))),a:mid,b:{...w.b}};
  w.b=mid;walls().push(second);return result(true,null,{first:w,second});
 }
 return Object.freeze({moveFace,moveVertex,splitWall,wallByFace,roomByFace});
}
