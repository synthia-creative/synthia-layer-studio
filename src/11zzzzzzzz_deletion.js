/* 表示削除は元データを保持し、既存の描画器と編集履歴へ合流させる。 */
(() => {
'use strict';
const kinds = new Set(['line','group','glyph','glyph-effect','cut','part']);
J.normalizeDeletedObjects = value => {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [id,r] of Object.entries(value).slice(0,20000)) {
    if (!/^deleted-[-a-zA-Z0-9_]{1,100}$/.test(id) || !r || !kinds.has(r.kind) || typeof r.owner !== 'string' || !/^cue-.{1,100}$/.test(r.owner) || typeof r.text !== 'string' || r.text.length > 10000) continue;
    if (['cut','part'].includes(r.kind) && (typeof r.signature !== 'string' || r.signature.length > 40000)) continue;
    const indices = [...new Set((Array.isArray(r.indices)?r.indices:[]).filter(i=>Number.isInteger(i)&&i>=0&&i<20000))].sort((a,b)=>a-b);
    if (r.kind.startsWith('glyph') && !indices.length) continue;
    out[id] = {kind:r.kind,owner:r.owner,text:r.text,...(r.signature?{signature:r.signature}:{}),...(r.kind.startsWith('glyph')?{indices}: {})};
  }
  return out;
};
const normalize = J.normalizeStudio;
J.normalizeStudio = value => ({...normalize(value),deletedObjects:J.normalizeDeletedObjects(value?.deletedObjects)});
// 保存済みのコードポイント番号を保ち、削除範囲だけを書記素クラスタ全体へ広げる。
J.deletionGlyphIndices = (text, indices) => {
  const source=String(text).replace(/\r?\n/g,''), requested=new Set(indices), out=[];
  const segments=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(source)].map(s=>s.segment):null;
  // 未対応環境ではクラスタ分割を推測せず、文字削除を拒否する。
  if(!segments)return [];
  let index=0;
  for(const segment of segments){const n=[...segment].length;if(Array.from({length:n},(_,i)=>index+i).some(i=>requested.has(i)))for(let i=0;i<n;i++)out.push(index+i);index+=n;}
  return out;
};
const recordCache=new WeakMap();
J.deletionRecords = (plan,line) => {
  if(!plan||!line)return [];
  const source=plan.studio?.deletedObjects;let cache=recordCache.get(plan);
  if(!cache||cache.source!==source){cache={source,rows:new Map()};for(const r of Object.values(source||{})){const key=JSON.stringify([r.owner,r.text]);if(!cache.rows.has(key))cache.rows.set(key,[]);cache.rows.get(key).push(r);}recordCache.set(plan,cache);}
  return cache.rows.get(JSON.stringify([J.subtitleGroupKey(line),line.text]))||[];
};
J.effectTargetDeleted = (plan,target) => {
  const line=plan.lines.find(l=>l.index===target?.line);
  return J.deletionRecords(plan,line).some(r=>['line','group'].includes(r.kind)||r.kind===target?.kind&&r.signature===target.signature||r.kind==='cut'&&r.signature===target?.cutSignature);
};
const planner=J.plan;
J.plan=(project,audio)=>{
  const plan=planner(project,audio);
  const bind=p=>{
    p.studio=plan.studio;
    for(const line of p.lines){
      let cursor=0;
      for(const root of p.cuts.filter(c=>c.line===line.index&&c.layout!=='interlude')){
        const match=J.studioGlyphMap(line.text,root.text,root.recap?0:cursor), mapped=match.found?match:J.studioGlyphMap(line.text,root.text);
        root.studioCharacterMap=mapped.map;if(!root.recap&&mapped.found)cursor=mapped.end;
        for(const cut of [root,...(typeof root.companion==='object'?[root.companion]:[])]){
          if(cut!==root)cut.studioCharacterMap=J.studioGlyphMap(line.text,cut.text).map;
          const parent=cut._effectCut;if(!parent)continue;
          const topology=JSON.stringify((cut.decor||[]).map(d=>d.id));
          (cut.decor||[]).forEach((d,i)=>{
            const slot='decor-'+i+'-'+d.id, signature=parent.signature+'|decor|'+topology+'|'+slot;
            const saved=Object.entries(plan.studio.partTransforms).find(([,r])=>r.owner===parent.owner&&r.signature===signature&&r.kind==='part');
            const target={...parent,id:saved?.[0]||'pending:'+parent.owner+':'+signature,transform:J.groupTransform(saved?.[1].transform),kind:'part',slot,text:d.id,signature,cutSignature:parent.signature,supported:true,decoration:true};
            cut._effectParts[slot]=target;plan.effectTargets.push(target);
          });
          if(cut.treat&&cut.treat!=='none'){
            const signature=parent.signature+'|treatment|'+cut.treat,saved=Object.entries(plan.studio.partTransforms).find(([,r])=>r.owner===parent.owner&&r.signature===signature&&r.kind==='part'),target={...parent,id:saved?.[0]||'pending:'+parent.owner+':'+signature,transform:J.groupTransform(saved?.[1].transform),kind:'part',slot:'treatment',text:cut.treat,signature,cutSignature:parent.signature,supported:true,treatment:true};
            cut._effectParts.treatment=target;plan.effectTargets.push(target);
          }
          for(const t of Object.values(cut._effectParts))t.cutSignature=parent.signature;
          // 明示スロットのあるレイアウトは同じ文字の別出現を区別する。
          if(J.deletionRecords(p,line).length)cut._effectGlyphMapping=true;
        }
      }
    }
  };
  if(plan.layerGroups?.length)for(const g of plan.layerGroups)bind(g.plan);else bind(plan);
  plan.deletedEffectTargets=plan.effectTargets.filter(t=>J.effectTargetDeleted(plan,t));
  const active=new Set(plan.effectTargets.map(t=>t.id));plan.suspendedEffectTransforms=Object.keys(plan.studio.partTransforms).filter(id=>!active.has(id));
  return plan;
};
J.prepareObjectDeletion=(project,selection,currentPlan)=>{
  const plan=currentPlan||J.plan(project,J.ui?.audio);
  if(!selection)return null;
  if(selection.kind==='instrumental'){
    const s=project.studio?.instrumentalFx,key=selection.source==='auto'?'autoEffects':'manualEffects',fx=s?.[key].find(e=>e.id===selection.id);
    if(!fx||fx.locked)return null;
    return {instrumental:true,key,id:fx.id};
  }
  const line=plan.lines.find(l=>l.index===selection.line);
  if(!line||J.groupLocked(project,line)||!kinds.has(selection.kind))return null;
  const record={kind:selection.kind,owner:J.subtitleGroupKey(line),text:line.text};
  if(['cut','part'].includes(selection.kind)){
    const target=plan.effectTargets.find(t=>t.id===selection.id&&t.kind===selection.kind&&t.signature===selection.signature);
    if(!target||J.effectTargetDeleted(plan,target))return null;
    record.signature=target.signature;
  }
  if(selection.kind.startsWith('glyph')){
    record.indices=J.deletionGlyphIndices(line.text,selection.indices||[selection.index]);
    if(!record.indices.length)return null;
  }
  if(J.deletionRecords(plan,line).some(r=>JSON.stringify(r)===JSON.stringify(record)))return null;
  return {record,line};
};
J.deleteSelectedObject=(project,selection,currentPlan)=>{
  const prepared=J.prepareObjectDeletion(project,selection,currentPlan);if(!prepared)return false;
  if(prepared.instrumental){const s=project.studio.instrumentalFx;s[prepared.key]=s[prepared.key].filter(e=>e.id!==prepared.id);return true;}
  const {record,line}=prepared;
  project.studio.deletedObjects ||= {};
  if(Object.keys(project.studio.deletedObjects).length>=20000)throw new Error(J.layerText('削除記録の上限に達しました。','Deleted-object limit reached.'));
  record.owner=J.setSubtitleGroup(project,line,project.studio.groups?.[J.subtitleGroupKey(line)]);
  project.studio.deletedObjects['deleted-'+crypto.randomUUID()]=record;return true;
};
const drawCut=J.Renderer.prototype.drawCut;
J.Renderer.prototype.drawCut=function(env){
  if(!env._groupMeasuring){
    const line=env.plan.lines.find(l=>l.index===env.cut.line),records=J.deletionRecords(env.plan,line);
    if(records.some(r=>['line','group'].includes(r.kind)||r.kind==='cut'&&r.signature===env.cut._effectCut?.signature))return null;
    const treatment=env.cut._effectParts?.treatment;
    if(treatment&&records.some(r=>r.kind==='part'&&r.signature===treatment.signature)){
      const cut={...env.cut,treat:'none'};env=this.makeEnv(env.ctx,env.plan,cut,env.sc,{...env,cut});
    }
  }
  return drawCut.call(this,env);
};
const renderPart=J.renderEffectPart;
// 描画だけを止め、返却する文字境界は保持する。残す装飾の基準を変えない。
J.withDeletedPaint=(env,draw)=>{
  const ctx=env.ctx,saved={},own={},methods=['fill','stroke','fillRect','strokeRect','fillText','strokeText','drawImage','putImageData'],log=env.glyphLog,capturing=J.studioCapturing,partCapturing=J.partCapturing;
  for(const key of methods){saved[key]=ctx[key];own[key]=Object.prototype.hasOwnProperty.call(ctx,key);ctx[key]=()=>{};}
  env.glyphLog=null;J.studioCapturing=false;J.partCapturing=false;
  try{return draw();}finally{env.glyphLog=log;J.studioCapturing=capturing;J.partCapturing=partCapturing;for(const key of methods)if(own[key])ctx[key]=saved[key];else delete ctx[key];}
};
J.renderEffectPart=(env,slot,text,draw)=>{
  const target=env.cut._effectParts?.[slot],line=env.plan.lines.find(l=>l.index===env.cut.line);
  if(!env._groupMeasuring&&target&&J.deletionRecords(env.plan,line).some(r=>r.kind==='part'&&r.signature===target.signature))return J.withDeletedPaint(env,draw);
  return renderPart(env,slot,text,draw);
};
// 各装飾の描画呼び出しをカット内の独立スロットへ接続する。
for(const [id,D] of Object.entries(J.DECOR)){
  const draw=D.draw;
  D.draw=(env,bb,d)=>{
    const i=env.cut?.decor?.indexOf(d),slot='decor-'+i+'-'+id;
    return i>=0&&env.cut._effectParts?.[slot]?J.renderEffectPart(env,slot,id,()=>draw(env,bb,d)):draw(env,bb,d);
  };
}
const drawItem=J.drawItem;
J.drawItem=(env,it)=>{
  if(env._groupMeasuring||!it.text||it._deletionApplied)return drawItem(env,it);
  const line=env.plan?.lines.find(l=>l.index===env.cut?.line),records=J.deletionRecords(env.plan,line),hidden=new Set(records.filter(r=>r.kind==='glyph').flatMap(r=>r.indices));
  const match=J.studioGlyphMap(env.cut?.text||'',it.text,env._studioGlyphStart||0);
  if(!hidden.size||!match.found)return drawItem(env,it);
  const old=it.charFn,indices=match.map.map(i=>env.cut.studioCharacterMap?.[i]??i);
  return drawItem(env,{...it,_deletionApplied:true,charFn:(i,g,n)=>({...old?.(i,g,n),...(hidden.has(indices[i])?{_displayDeleted:true}:{})})});
};
// 文字効果のみの削除は、その文字をアニメーション適用前の位置で描き、手動変形は保持する。
const mainDraw=J.mainDraw;
J.mainDraw=(env,it)=>{
  if(env._groupMeasuring)return mainDraw(env,it);
  const line=env.plan?.lines.find(l=>l.index===env.cut?.line),effects=new Set(J.deletionRecords(env.plan,line).filter(r=>r.kind==='glyph-effect').flatMap(r=>r.indices));
  const match=J.studioGlyphMap(env.cut?.text||'',it.text,env._studioGlyphStart||0);
  if(!effects.size||!match.found)return mainDraw(env,it);
  const indices=match.map.map(i=>env.cut.studioCharacterMap?.[i]??i),base={...it},filteredDraw=J.drawItem;
  // 同期描画の間だけフィルタを合成。生成済み状態や描画順は変更しない。
  J.drawItem=(e,item)=>{const old=item.charFn;return filteredDraw(e,{...item,charFn:(i,g,n)=>({...old?.(i,g,n),...(effects.has(indices[i])?{hide:true}:{})})});};
  let bb;try{bb=mainDraw(env,it);}finally{J.drawItem=filteredDraw;}
  const result=filteredDraw(env,{...base,charFn:i=>effects.has(indices[i])?null:{hide:true}});return bb||result;
};
// 明示的なSRT化・複製でも所有者を追従させ、別字幕へ同じIDを共有しない。
const ensure=J.studioEnsureCues,duplicate=J.studioDuplicateCue,remove=J.deleteLayerCue;
J.studioEnsureCues=project=>{const old=Array.isArray(project.subtitleCues)?null:J.plan(project,J.ui?.audio).lines.map(J.subtitleGroupKey),cues=ensure(project);if(old)for(const r of Object.values(project.studio.deletedObjects||{})){const i=old.indexOf(r.owner);if(i>=0)r.owner='cue-'+cues[i].id;}return cues;};
J.studioDuplicateCue=(project,index)=>{J.studioEnsureCues(project);const owner='cue-'+project.subtitleCues[index]?.id,id=duplicate(project,index);for(const r of Object.values(project.studio.deletedObjects||{}))if(r.owner===owner)project.studio.deletedObjects['deleted-'+crypto.randomUUID()]={...structuredClone(r),owner:'cue-'+id};return id;};
J.deleteLayerCue=(project,index)=>{const owner='cue-'+project.subtitleCues?.[index]?.id;remove(project,index);for(const [id,r] of Object.entries(project.studio.deletedObjects||{}))if(r.owner===owner)delete project.studio.deletedObjects[id];};
})();
