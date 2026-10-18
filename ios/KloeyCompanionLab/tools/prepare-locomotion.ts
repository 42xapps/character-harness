// Retarget CC0 Quaternius motion through the harness's normalized-humanoid code.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readGlb, writeGlb, addAccessor, type Glb } from './vendor/harness/glb.ts';
import { readHumanoid, type HumanBone } from './vendor/harness/humanoid.ts';
import { retarget } from './vendor/harness/retarget.ts';
import { compose, mmul, mpoint, type Mat4, type Quat, type Vec3 } from './vendor/harness/math.ts';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'art/locomotion/source');
const src: Glb = { json: JSON.parse(readFileSync(path.join(source, 'AnimationLibrary.gltf'), 'utf8')),
 bin: readFileSync(path.join(source, 'AnimationLibrary_Godot_Standard.bin')) };
const target = readGlb(path.join(root, 'app/assets/foxglove/foxglove.glb'));
const sourceNames: Record<string,string> = {hips:'DEF-hips',spine:'DEF-spine.001',chest:'DEF-spine.002',upperChest:'DEF-spine.003',neck:'DEF-neck',head:'DEF-head'};
const targetNames: Record<string,string> = {hips:'J_Bip_C_Hips',spine:'J_Bip_C_Spine',chest:'J_Bip_C_Chest',upperChest:'J_Bip_C_UpperChest',neck:'J_Bip_C_Neck',head:'J_Bip_C_Head'};
for (const [side, suffix, letter] of [['left','L','L'],['right','R','R']]) {
 for (const [role,srcName,tgtName] of [['Shoulder','shoulder','Shoulder'],['UpperArm','upper_arm','UpperArm'],['LowerArm','forearm','LowerArm'],['Hand','hand','Hand'],['UpperLeg','thigh','UpperLeg'],['LowerLeg','shin','LowerLeg'],['Foot','foot','Foot'],['Toes','toe','ToeBase']]) {
  sourceNames[side+role]=`DEF-${srcName}.${suffix}`; targetNames[side+role]=`J_Bip_${letter}_${tgtName}`;
 }
 for (const [finger,srcFinger] of [['Index','f_index'],['Middle','f_middle'],['Ring','f_ring'],['Little','f_pinky'],['Thumb','thumb']]) {
  const segments=finger==='Thumb'?['Metacarpal','Proximal','Distal']:['Proximal','Intermediate','Distal'];
  segments.forEach((segment,i)=>{sourceNames[side+finger+segment]=`DEF-${srcFinger}.0${i+1}.${suffix}`;targetNames[side+finger+segment]=`J_Bip_${letter}_${finger}${i+1}`;});
 }
}
function map(glb:Glb,names:Record<string,string>) {
 const bones:Record<string,{node:number}>={};
 for(const [role,name] of Object.entries(names)) {const node=glb.json.nodes!.findIndex(n=>n.name===name);if(node>=0)bones[role]={node};}
 glb.json.extensions={VRMC_vrm_animation:{specVersion:'1.0',humanoid:{humanBones:bones}}};
 return readHumanoid(glb)!;
}
const sh=map(src,sourceNames),th=map(target,targetNames);
const nodes=structuredClone(target.json.nodes!);for(const n of nodes){delete n.mesh;delete (n as typeof n & {skin?:number}).skin;}
const out:Glb={json:{asset:{version:'2.0',generator:'Kloey/harness retarget'},nodes,scenes:[{nodes:nodes.map((_,i)=>i).filter(i=>th.parent[i]<0)}],scene:0,animations:[]},bin:Buffer.alloc(0)};
const all=src.json.animations!;
for(const [from,name] of [['Walk_Loop','stroll'],['Walk_Formal_Loop','stroll_formal']]) {
 const anim=all.find(a=>a.name===from);if(!anim)throw new Error(`Missing ${from}`);
 src.json.animations=[anim];
 const clip=retarget(src,sh,th);
 const input=addAccessor(out,clip.times,'SCALAR',true),samplers=[],channels=[];
 for(const t of clip.tracks){const output=addAccessor(out,t.values,t.path==='rotation'?'VEC4':'VEC3');samplers.push({input,output,interpolation:'LINEAR'});channels.push({sampler:samplers.length-1,target:{node:t.node,path:t.path}});}
 out.json.animations!.push({name,samplers,channels});
 console.log(`${name}: ${clip.times.at(-1)!.toFixed(3)} s, ${clip.tracks.length} tracks`);
}
const output=path.join(root,'app/assets/foxglove/locomotion.glb');writeFileSync(output,writeGlb(out));
console.log(output);
// Measure stance-foot travel on the retargeted avatar, rather than guess a cadence.
const stroll=retarget({...src,json:{...src.json,animations:[all.find(a=>a.name==='Walk_Loop')!]}},sh,th);
for(const role of ['leftFoot','rightFoot'] as HumanBone[]) {
 const positions=Array.from(stroll.times,(_,f)=>{
  const local=th.local.map(p=>({t:p.t,r:p.r,s:p.s}));
  for(const t of stroll.tracks) {const v=Array.from(t.values.subarray(f*(t.path==='rotation'?4:3),(f+1)*(t.path==='rotation'?4:3)));if(t.path==='rotation')local[t.node].r=v as Quat;else local[t.node].t=v as Vec3;}
  const world:Mat4[]=[];const at=(i:number):Mat4=>world[i]??(world[i]=th.parent[i]<0?compose(local[i].t,local[i].r,local[i].s):mmul(at(th.parent[i]),compose(local[i].t,local[i].r,local[i].s)));
  return mpoint(at(th.bones[role]!),[0,0,0]);
 });
 const low=Math.min(...positions.map(p=>p[1])),vel=[];
 for(let i=1;i<positions.length;i++)if(positions[i][1]<low+.035&&positions[i-1][1]<low+.035)vel.push((positions[i][2]-positions[i-1][2])/(stroll.times[i]-stroll.times[i-1]));
 vel.sort((a,b)=>a-b);console.log(`${role}: lowest ankle ${low.toFixed(3)}m, stance velocity ${vel[Math.floor(vel.length/2)]?.toFixed(3)} m/s`);
}
