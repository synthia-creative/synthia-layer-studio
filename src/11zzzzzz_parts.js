/* カットと描画ブロックを明示的に束ねる。文字列検索や描画済み画像の切り抜きは使わない。 */
(() => {
'use strict';
J.normalizeEffectTransforms = value => {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [id,r] of Object.entries(value).slice(0,20000)) {
    if (!/^part-[-a-zA-Z0-9_]{1,100}$/.test(id) || !r || !/^cue-.{1,100}$/.test(r.owner) || typeof r.signature !== 'string' || r.signature.length > 30000) continue;
    if (!['cut','part'].includes(r.kind)) continue;
    out[id] = {owner:r.owner, signature:r.signature, kind:r.kind, transform:J.groupTransform(r.transform)};
  }
  return out;
};
// 同じ分割規則を生成時と描画時で共有し、書体や配色の変更を構成変更と誤認しない。
J.tapePartTexts = (cut,W,H) => {
  const txt=String(cut.text).trim();
  let parts=(cut.words?.length>1?cut.words:[txt]).map(p=>p.trim()).filter(Boolean);
  if(parts.length>4){const k=Math.ceil(parts.length/4),q=[];for(let i=0;i<parts.length;i+=k)q.push(parts.slice(i,i+k).join(''));parts=q;}
  if(parts.length===1&&J.glyphCount(txt)>(W<H?5:9))parts=J.splitLines(txt,Math.ceil(J.glyphCount(txt)/2)).split('\n');
  return parts;
};
J.labelPartTexts = cut => {
  const txt=cut.text.replace(/\s+/g,''),p=cut.params;
  const units=p.unit==='char'?[...txt].filter(c=>!J.isPunct(c)):(cut.words?.length?cut.words:[txt]);
  return units.length?units:[txt];
};
J.effectPartSpecs = (cut,W,H) => {
  const p=cut.params||{},out=/** @type {{slot:string,text:string,glyphStart?:number}[]} */([]);
  if(cut.layout==='tape'){
    if(p.variant==='stack')J.tapePartTexts(cut,W,H).forEach((text,i)=>out.push({slot:'tape-row-'+i,text}));
    else {if(p.variant==='cross')out.push({slot:'tape-cross',text:cut.lineText||cut.text});out.push({slot:'tape-main',text:cut.text});}
  } else if(cut.layout==='labels'){
    const units=J.labelPartTexts(cut),n=p.variant==='radial'?Math.max(units.length,10):units.length;
    for(let i=0;i<n;i++)out.push({slot:'label-'+i,text:units[i%units.length]});
    if(p.variant==='radial'&&p.center!=='none')out.push({slot:'label-center',text:p.center==='word'?cut.text:'●'});
  } else if(cut.layout==='panels'){
    (p.chunks?.length?p.chunks:[cut.text]).forEach((text,i)=>out.push({slot:'panel-'+i,text}));
  }
  // 描画スロットから文字位置の開始点も渡す。同じ語や文字の別スロットを区別する。
  let cursor=0;
  for(const s of out){
    if(s.slot==='label-center'||s.slot==='tape-main'||s.slot==='tape-cross')s.glyphStart=0;
    else if(cut.layout==='labels'&&p.unit==='char'){
      const chars=[...cut.text.replace(/\s+/g,'')],indices=chars.map((ch,i)=>({ch,i})).filter(r=>!J.isPunct(r.ch));
      s.glyphStart=indices[Number(s.slot.slice(6))%indices.length]?.i||0;
    }else if(cut.layout==='labels'){
      const units=J.labelPartTexts(cut),n=Number(s.slot.slice(6))%units.length;
      s.glyphStart=units.slice(0,n).reduce((sum,text)=>sum+[...text.replace(/\s+/g,'')].length,0);
    }else {s.glyphStart=cursor;cursor+=[...s.text.replace(/\s+/g,'')].length;}
  }
  return out;
};
const planner=J.plan;
J.plan=(project,audio)=>{
  const plan=planner(project,audio),records=plan.studio.partTransforms,targets=[],recordMap=new Map();
  for(const [id,r]of Object.entries(records)){const key=JSON.stringify([r.owner,r.kind,r.signature]);if(!recordMap.has(key))recordMap.set(key,[id,r]);}
  function bind(p){
    p.studio=plan.studio;
    for(const line of p.lines){
      const owner=J.subtitleGroupKey(line),cuts=p.cuts.filter(c=>c.line===line.index&&c.layout!=='interlude');
      const sequence=cuts.map(c=>[c.utext||c.text,typeof c.companion==='object'?c.companion.text:null]);
      cuts.forEach((root,i)=>{
        for(const [cut,role] of [[root,'main'],...(typeof root.companion==='object'?[[root.companion,'companion']]:[])]){
          const W=cut.zone?.w||p.W,H=cut.zone?.h||p.H,specs=J.effectPartSpecs(cut,W,H);
          // 時刻・書体・色は署名から外す。全文と分割構成が変われば旧値を退避する。
          const base=JSON.stringify([line.text,sequence,i,role]);
          const add=(kind,slot,text,signature)=>{
            const saved=recordMap.get(JSON.stringify([owner,kind,signature]));
            const t={id:saved?.[0]||'pending:'+owner+':'+signature,owner,signature,kind,slot,text,line:line.index,cutNumber:i+1,role,start:cut.start,end:cut.end,transform:J.groupTransform(saved?.[1].transform),supported:specs.length>0,glyphStart:specs.find(s=>s.slot===slot)?.glyphStart||0};
            targets.push(t);return t;
          };
          cut._effectCut=add('cut','cut',cut.text,base);cut._effectParts={};
          const topology=JSON.stringify([cut.layout,cut.params?.variant,specs]);
          for(const s of specs)cut._effectParts[s.slot]=add('part',s.slot,s.text,base+'|'+topology+'|'+s.slot);
          cut._effectGlyphMapping=cut._effectCut.id.startsWith('part-')||Object.values(cut._effectParts).some(t=>t.id.startsWith('part-'));
        }
      });
    }
  }
  if(plan.layerGroups?.length){
    for(const g of plan.layerGroups){
      const first=targets.length;
      for(const line of g.plan.lines){const top=plan.lines.find(l=>l.index===g.indices[line.index]);if(top){line.cueId=top.cueId;line.groupId=top.groupId;}}
      for(const cut of g.plan.cuts){const top=plan.cuts.find(c=>c.line===g.indices[cut.line]&&c.start===cut.start&&c.text===cut.text);if(top)cut.studioCharacterMap=top.studioCharacterMap;}
      bind(g.plan);
      // 一覧は全体の字幕番号、描画用の所属は各サブプランの行番号を保つ。
      for(const t of targets.slice(first))t.line=g.indices[t.line];
    }
  }else bind(plan);
  plan.effectTargets=targets;
  const activeIds=new Set(targets.map(t=>t.id));plan.suspendedEffectTransforms=Object.keys(records).filter(id=>!activeIds.has(id));
  return plan;
};
J.setEffectTransform=(project,target,value,currentPlan)=>{
  const plan=currentPlan||J.plan(project,J.ui?.audio),line=plan.lines.find(l=>l.index===target?.line);
  if(!target||!plan.effectTargets.some(t=>t.owner===target.owner&&t.signature===target.signature&&t.kind===target.kind)||J.groupLocked(project,line))return null;
  const owner=J.setSubtitleGroup(project,line,project.studio.groups?.[J.subtitleGroupKey(line)]);
  const id=target.id.startsWith('part-')?target.id:'part-'+crypto.randomUUID();
  project.studio.partTransforms[id]={owner,signature:target.signature,kind:target.kind,transform:J.groupTransform(value)};
  return id;
};
J.effectPartHits=[];
const active=[];
J.withoutEffectCapture=fn=>{
  const run=i=>i<active.length?active[i].pause(()=>run(i+1)):fn();return run(0);
};
const cache=new WeakMap();let measureCanvas;
function anchors(renderer,env){
  let found=cache.get(env.cut);if(found)return found;
  found={};measureCanvas ||= document.createElement('canvas');measureCanvas.width=measureCanvas.height=1;
  const ctx=measureCanvas.getContext('2d'),cut=env.cut,lt=Math.min(cut.dur*.8,Math.max(cut.inDur+.1,cut.dur*.65));
  const m=renderer.makeEnv(ctx,env.plan,cut,env.sc,{...env,ctx,lt,ltb:lt,t:cut.start+lt,pass:'main',passColor:null,scale:1,allowFilter:false,hideText:false,glyphLog:null,studioGlyph:()=>{},_groupMeasuring:true,_effectDiscover:found});
  m.pIn=1;m.pOut=0;(J.LAYOUTS[cut.layout]||J.LAYOUTS.center).render(m);cache.set(cut,found);return found;
}
function scope(env,target,bounds,draw){
  if(!target||env._groupMeasuring||env.bgOnly||env.inLayer)return draw();
  const p=target.transform,capturing=J.partCapturing&&env.pass==='main';
  if(!capturing&&J.groupIsIdentity(p))return draw();
  const ctx=env.ctx,before=ctx.getTransform(),center={x:(bounds.x0+bounds.x1)/2,y:(bounds.y0+bounds.y1)/2},matrix=J.groupMatrix(p,center,env.plan.W,env.plan.H);
  const transformed=!J.groupIsIdentity(p);if(transformed){ctx.save();ctx.transform(matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f);}
  const recorder=capturing?J.recordGroupGeometry(ctx):null;if(recorder)active.push(recorder);
  try{
    const result=draw(),b=recorder?.bounds();
    if(b){const total=ctx.getTransform();J.effectPartHits.push({id:target.id,target,bounds:b,center:J.groupPoint(total,center),basis:{a:before.a,b:before.b,c:before.c,d:before.d},transform:p});}
    return result;
  }finally{if(recorder){active.pop();recorder.close();}if(transformed)ctx.restore();}
}
J.hasEffectTransforms=env=>!!env.cut._effectCut&&!J.groupIsIdentity(env.cut._effectCut.transform)||Object.values(env.cut._effectParts||{}).some(t=>!J.groupIsIdentity(t.transform));
J.withCutTransform=(renderer,env,draw)=>{
  if(env._groupMeasuring)return draw();
  env._effectAnchors=(J.partCapturing||J.hasEffectTransforms(env))?anchors(renderer,env):null;
  return scope(env,env.cut._effectCut,J.subtitleGroupBounds(renderer,env),draw);
};
J.renderEffectPart=(env,slot,text,draw)=>{
  const t=env.cut._effectParts?.[slot],previous=env._studioGlyphStart;env._studioGlyphStart=env.cut._effectGlyphMapping?t?.glyphStart||0:previous;
  try{
  if(env._effectDiscover){const r=J.recordGroupGeometry(env.ctx);try{const result=draw();env._effectDiscover[slot]=r.bounds();return result;}finally{r.close();}}
  const b=env._effectAnchors?.[slot]||{x0:env.W*.35,y0:env.H*.4,x1:env.W*.65,y1:env.H*.6};
  return scope(env,t,b,draw);
  }finally{env._studioGlyphStart=previous;}
};
const ensure=J.studioEnsureCues,duplicate=J.studioDuplicateCue,remove=J.deleteLayerCue;
J.studioEnsureCues=project=>{const old=Array.isArray(project.subtitleCues)?null:J.plan(project,J.ui?.audio).lines.map(J.subtitleGroupKey),cues=ensure(project);if(old)for(const r of Object.values(project.studio.partTransforms)){const i=old.indexOf(r.owner);if(i>=0)r.owner='cue-'+cues[i].id;}return cues;};
J.studioDuplicateCue=(project,index)=>{J.studioEnsureCues(project);const owner='cue-'+project.subtitleCues[index]?.id,id=duplicate(project,index);for(const r of Object.values(project.studio.partTransforms))if(r.owner===owner)project.studio.partTransforms['part-'+crypto.randomUUID()]={...structuredClone(r),owner:'cue-'+id};return id;};
J.deleteLayerCue=(project,index)=>{const owner='cue-'+project.subtitleCues?.[index]?.id;remove(project,index);for(const [id,r]of Object.entries(project.studio.partTransforms))if(r.owner===owner)delete project.studio.partTransforms[id];};
})();
