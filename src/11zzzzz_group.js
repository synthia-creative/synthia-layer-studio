/* 字幕の描画スコープに親変形を追加する。背景・画面装飾はこのスコープに含めない。 */
(() => {
'use strict';
const finite = (v, d, lo, hi) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
J.groupTransform = v => ({ x: finite(v?.x, 0, -4, 4), y: finite(v?.y, 0, -4, 4), scale: Number.isFinite(v?.scale) && v.scale > 0 ? finite(v.scale, 1, .05, 10) : 1, rotation: finite(v?.rotation, 0, -360, 360) });
J.normalizeSubtitleGroups = value => {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [key, row] of Object.entries(value).slice(0, 20000))
    if (/^(line-\d+|cue-.{1,100})$/.test(key) && row && typeof row === 'object') out[key] = J.groupTransform(row);
  return out;
};
J.normalizeSubtitleGroupLines = value => (Array.isArray(value)?value:[]).slice(0,20000).filter(r=>r&&typeof r.id==='string'&&/^[-a-zA-Z0-9_]{1,100}$/.test(r.id)&&typeof r.text==='string'&&Number.isInteger(r.index)&&r.index>=0).map(r=>({id:r.id,text:r.text.slice(0,10000),index:r.index}));
J.subtitleGroupKey = line => line?.cueId || line?.groupId ? 'cue-' + (line.cueId || line.groupId) : J.studioLineKey(line);
const planner = J.plan;
J.plan = (project,audio) => {
  const plan = planner(project,audio);
  const used = new Set(), rows=project.studio?.groupLines||[];
  // 同文は元の位置を先に確保し、並べ替え時は本文一致を優先して別字幕への移動を防ぐ。
  for(const match of ['exactIndex','exactText','index'])for(const line of plan.lines){
    if(line.cueId||line.groupId)continue;
    const row=rows.find(r=>!used.has(r.id)&&(match==='exactIndex'?r.index===line.index&&r.text===line.text:match==='exactText'?r.text===line.text:r.index===line.index));
    const id=row?.id||(match==='index'&&project.overrides?.[line.index]?.groupId);
    if(typeof id==='string'&&/^[-a-zA-Z0-9_]{1,100}$/.test(id)){line.groupId=id;used.add(id);}
  }
  return plan;
};
J.setSubtitleGroup = (project,line,value) => {
  if(J.groupLocked(project,line))return null;
  const from=J.subtitleGroupKey(line);
  if(!line.cueId&&!line.groupId){
    line.groupId='group-'+crypto.randomUUID();
  }
  if(!line.cueId){const rows=project.studio.groupLines||(project.studio.groupLines=[]),row=rows.find(r=>r.id===line.groupId);if(row){row.text=line.text;row.index=line.index;}else rows.push({id:line.groupId,text:line.text,index:line.index});}
  const key=J.subtitleGroupKey(line);project.studio.groups[key]=J.groupTransform(value);
  if(key!==from)delete project.studio.groups[from];return key;
};
J.groupIsIdentity = p => !p.x && !p.y && p.scale === 1 && !p.rotation;
J.groupLocked = (project, line) => !line || !!(project.subtitleCues?.[line.index]?.locked || project.overrides?.[line.index]?.lock || project.locks?.params?.[J.studioLineKey(line)]);
J.groupMatrix = (value, center, W, H) => {
  const p = J.groupTransform(value), a = p.scale * Math.cos(p.rotation * J.DEG), b = p.scale * Math.sin(p.rotation * J.DEG);
  return { a, b, c: -b, d: a, e: center.x + p.x * W - a * center.x + b * center.y, f: center.y + p.y * H - b * center.x - a * center.y };
};
J.groupPoint = (m, p) => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f });
J.groupInversePoint = (m, p) => { const d = m.a * m.d - m.b * m.c; return { x: (m.d * (p.x - m.e) - m.c * (p.y - m.f)) / d, y: (-m.b * (p.x - m.e) + m.a * (p.y - m.f)) / d }; };
J.groupMultiply = (a, b) => ({ a: a.a*b.a+a.c*b.b, b: a.b*b.a+a.d*b.b, c: a.a*b.c+a.c*b.d, d: a.b*b.c+a.d*b.d, e: a.a*b.e+a.c*b.f+a.e, f: a.b*b.e+a.d*b.f+a.f });
// 文字の手動位置は既存drawItemが親変形の後に1回だけ適用する。値と装飾の従来位置は保持する。
J.subtitleGroupHits = [];
// 座標に依存しない画面装飾。レイアウト内部のテープ・ラベルは常に字幕に属する。
J.groupDecorationScope = id => {
  const D = J.DECOR[id];
  return D && ((D.layer === 'back' && id !== 'counter') || ['decoCorners', 'punchHoles'].includes(id)) ? 'screen' : 'subtitle';
};
const drawCut = J.Renderer.prototype.drawCut;
const drawParts = (renderer, env) => {
  const bb = (J.LAYOUTS[env.cut.layout] || J.LAYOUTS.center).render(env);
  for (const d of env.cut.decor || []) {
    const D = J.DECOR[d.id];
    if (D && D.layer === 'front' && J.groupDecorationScope(d.id) === 'subtitle') D.draw(env, bb, d);
  }
  return bb;
};
// 実Canvasの幾何だけを記録する。1pxの測定Canvasなので画面外の影や回転を切り取らない。
J.recordGroupGeometry = ctx => {
  const points = [], saved = {}, own = {}, path = []; let activePath = path, paused = false;
  const add = (x,y,pad=0,target=points) => {
    if (paused || !Number.isFinite(x+y) || ctx.globalAlpha <= .002) return;
    const m = ctx.getTransform(), p = J.groupPoint(m,{x,y}), k = Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d));
    target.push({x:p.x-pad*k,y:p.y-pad*k},{x:p.x+pad*k,y:p.y+pad*k});
  };
  const patch = (key, fn) => { own[key] = Object.prototype.hasOwnProperty.call(ctx,key); saved[key] = ctx[key]; ctx[key] = function(...a){fn(...a);return saved[key].apply(this,a);}; };
  const rect = (x,y,w,h,pad=0,target=points) => {for(const X of [x,x+w])for(const Y of [y,y+h])add(X,Y,pad,target);};
  patch('fillRect',(x,y,w,h)=>rect(x,y,w,h));
  patch('strokeRect',(x,y,w,h)=>rect(x,y,w,h,ctx.lineWidth/2));
  patch('drawImage',(image,...a)=>{const d=a.length===8?a.slice(4):a;rect(d[0],d[1],d[2]??image.width,d[3]??image.height);});
  patch('beginPath',()=>{activePath=[];});
  for (const key of ['moveTo','lineTo']) patch(key,(x,y)=>add(x,y,0,activePath));
  patch('rect',(x,y,w,h)=>rect(x,y,w,h,0,activePath));
  patch('roundRect',(x,y,w,h)=>rect(x,y,w,h,0,activePath));
  patch('arc',(x,y,r)=>rect(x-r,y-r,r*2,r*2,0,activePath));
  patch('ellipse',(x,y,rx,ry)=>rect(x-Math.max(rx,ry),y-Math.max(rx,ry),2*Math.max(rx,ry),2*Math.max(rx,ry),0,activePath));
  patch('arcTo',(x,y,X,Y,r)=>{add(x,y,r,activePath);add(X,Y,r,activePath);});
  patch('quadraticCurveTo',(x,y,X,Y)=>{add(x,y,0,activePath);add(X,Y,0,activePath);});
  patch('bezierCurveTo',(x,y,X,Y,u,v)=>{add(x,y,0,activePath);add(X,Y,0,activePath);add(u,v,0,activePath);});
  for(const key of ['fill','stroke']) patch(key,()=>{if(!paused&&ctx.globalAlpha>.002)points.push(...activePath);});
  for(const key of ['fillText','strokeText']) patch(key,(text,x,y)=>{
    const m=ctx.measureText(text), size=parseFloat(ctx.font.match(/[\d.]+px/)?.[0]||'20'), w=m.width, h=size*1.2, pad=(key==='strokeText'?ctx.lineWidth:0)+(ctx.shadowBlur||0)*2;
    const left=ctx.textAlign==='left'||ctx.textAlign==='start'?x:ctx.textAlign==='right'||ctx.textAlign==='end'?x-w:x-w/2;
    rect(left,y-h/2,w,h,pad);
  });
  return { pause:fn=>{paused=true;try{return fn();}finally{paused=false;}}, bounds:()=> {
    if(!points.length)return null;
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const p of points){x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y);}
    return {x0,y0,x1,y1};
  }, close:()=>{for(const key in saved)if(own[key])ctx[key]=saved[key];else delete ctx[key];} };
};
const boundsCache = new WeakMap(); let measureCanvas;
J.subtitleGroupBounds = (renderer, env) => {
  let bounds = boundsCache.get(env.cut); if(bounds)return bounds;
  measureCanvas ||= document.createElement('canvas'); measureCanvas.width=measureCanvas.height=1;
  const ctx=measureCanvas.getContext('2d'), recorder=J.recordGroupGeometry(ctx);
  const cut={...env.cut}, lt=Math.min(cut.dur*.6,Math.max(cut.inDur+.05,cut.dur/2));
  const measure=renderer.makeEnv(ctx,env.plan,cut,env.sc,{...env,ctx,cut,pass:'main',passColor:null,lt,ltb:lt,t:cut.start+lt,pIn:1,pOut:0,scale:1,allowFilter:false,hideText:false,glyphLog:null,studioGlyph:()=>{},_groupScope:true,_groupMeasuring:true});
  // makeEnvのpIn/pOut計算より後に静止時の基準を固定する。
  measure.pIn=1;measure.pOut=0;
  try {
    for(const d of cut.decor||[])if(J.DECOR[d.id]?.layer==='back'&&J.groupDecorationScope(d.id)==='subtitle')J.DECOR[d.id].draw(measure,null,d);
    drawParts(renderer,measure);bounds=recorder.bounds()||{x0:env.W*.35,y0:env.H*.4,x1:env.W*.65,y1:env.H*.6};
  } finally {recorder.close();}
  boundsCache.set(env.cut,bounds);return bounds;
};
J.Renderer.prototype.drawCut = function(env) {
  const line=env.plan.lines.find(l=>l.index===env.cut.line), key=J.subtitleGroupKey(line), p=J.groupTransform(env.plan.studio?.groups?.[key]);
  const needsBounds=J.groupCapturing||J.partCapturing||!!J.VideoAnalysis.capture;
  if(!line||env.bgOnly||env.inLayer||env._groupScope||(!needsBounds&&J.groupIsIdentity(p)&&!J.hasEffectTransforms?.(env)))return drawCut.call(this,env);
  const ctx=env.ctx, bounds=J.subtitleGroupBounds(this,env), zone=env.zone, origin={x:zone?.x||0,y:zone?.y||0};
  const world={x0:bounds.x0+origin.x,y0:bounds.y0+origin.y,x1:bounds.x1+origin.x,y1:bounds.y1+origin.y};
  const partner=typeof env.cut.companion==='object'?env.cut.companion:env.plan.cuts.find(c=>c.companion===env.cut);
  if(partner){const z=partner.zone||{},b=J.subtitleGroupBounds(this,{...env,cut:partner,zone:partner.zone,W:z.w||env.plan.W,H:z.h||env.plan.H});world.x0=Math.min(world.x0,b.x0+(z.x||0));world.y0=Math.min(world.y0,b.y0+(z.y||0));world.x1=Math.max(world.x1,b.x1+(z.x||0));world.y1=Math.max(world.y1,b.y1+(z.y||0));}
  const center={x:(world.x0+world.x1)/2,y:(world.y0+world.y1)/2}, k=env.scale||1;
  const matrix=J.groupMatrix(p,center,env.plan.W,env.plan.H);
  const device={...matrix,e:matrix.e*k,f:matrix.f*k}, before=ctx.getTransform();
  // グループはカメラ・文字の外側の親。カメラの既存行列は保持する。
  const combined=J.groupMultiply(device,before);
  const screen=fn=>{ctx.save();ctx.setTransform(before);try{const draw=()=>J.withoutEffectCapture?J.withoutEffectCapture(fn):fn();return recorder?recorder.pause(draw):draw();}finally{ctx.restore();}};
  // makeEnvでdraw等のクロージャも作り直し、測定用スコープを実描画へ漏らさない。
  const scoped=this.makeEnv(ctx,env.plan,env.cut,env.sc,{...env,_groupScope:true});let bb=null;
  ctx.save();ctx.setTransform(combined.a,combined.b,combined.c,combined.d,combined.e,combined.f);
  const recorder=needsBounds&&env.pass==='main'?J.recordGroupGeometry(ctx):null;
  try {
    const drawSubtitle=()=>{
    if(env.layer!=='front')for(const d of env.cut.decor||[]){const D=J.DECOR[d.id];if(D?.layer==='back'){
      if(J.groupDecorationScope(d.id)==='screen')screen(()=>D.draw(env,null,d));
      else D.draw(scoped,null,d);
    }}
      if(env.layer!=='back'){
        bb=(J.LAYOUTS[env.cut.layout]||J.LAYOUTS.center).render(scoped);
        for(const d of env.cut.decor||[]){const D=J.DECOR[d.id];if(D?.layer==='front'){
          if(J.groupDecorationScope(d.id)==='screen')screen(()=>D.draw(env,bb,d));else D.draw(scoped,bb,d);
        }}
      }
    return bb;
    };
    if(J.withCutTransform)J.withCutTransform(this,scoped,drawSubtitle);else drawSubtitle();
      const actual=recorder?.bounds();
      if(actual){
        if(J.groupCapturing){
          const previous=J.subtitleGroupHits.find(h=>h.key===key);
          if(previous){const b=previous.bounds;b.x0=Math.min(b.x0,actual.x0);b.y0=Math.min(b.y0,actual.y0);b.x1=Math.max(b.x1,actual.x1);b.y1=Math.max(b.y1,actual.y1);}
          else J.subtitleGroupHits.push({key,line:line.index,bounds:actual,center:J.groupPoint(device,{x:center.x*k,y:center.y*k}),basis:{a:k,b:0,c:0,d:k},transform:p});
        }
        if(J.VideoAnalysis.capture)J.VideoAnalysis.capture.push({key:J.studioLineKey(line),x:actual.x0/ctx.canvas.width,y:actual.y0/ctx.canvas.height,w:(actual.x1-actual.x0)/ctx.canvas.width,h:(actual.y1-actual.y0)/ctx.canvas.height,color:env.sc.fg});
      }
    return bb;
  }finally{recorder?.close();ctx.restore();}
};
// 複製・旧歌詞からSRT化・削除でもキーを字幕に追従させる。
const ensure=J.studioEnsureCues, duplicate=J.studioDuplicateCue, remove=J.deleteLayerCue;
J.studioEnsureCues=project=>{
  const previous=Array.isArray(project.subtitleCues)?null:J.plan(project,J.ui.audio).lines.map(J.subtitleGroupKey), cues=ensure(project);
  if(previous)for(let i=0;i<cues.length;i++){const from=previous[i],to='cue-'+cues[i].id;if(project.studio.groups[from]){project.studio.groups[to]=structuredClone(project.studio.groups[from]);if(from!==to)delete project.studio.groups[from];}}
  return cues;
};
J.studioDuplicateCue=(project,index)=>{const key='cue-'+project.subtitleCues[index]?.id,id=duplicate(project,index);if(project.studio.groups[key])project.studio.groups['cue-'+id]=structuredClone(project.studio.groups[key]);return id;};
J.deleteLayerCue=(project,index)=>{const key='cue-'+project.subtitleCues[index]?.id;remove(project,index);if(project.studio?.groups)delete project.studio.groups[key];};
})();
