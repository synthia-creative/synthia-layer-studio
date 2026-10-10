/* 一覧は時間外・画面外・重なった対象の復帰経路。操作枠はプレビュー専用。 */
(() => {
'use strict';
function boot(){
  const el=J.studioElement,tr=J.layerText,root=document.getElementById('studio-characterEditing'),mode=/** @type {HTMLSelectElement} */(document.getElementById('studioCharacterMode')),view=/** @type {HTMLCanvasElement} */(document.getElementById('view'));
  root.querySelector('summary').textContent=tr('文字・行・演出全体・カット編集','Character / line / group / cut editing');
  const option=el('option',tr('カット・パーツ / Cut・Part','Cut / Part'));option.value='part';mode.insertBefore(option,mode.options[2]);
  const panel=el('div',null,'studioPartPanel'),status=el('p',null,'studioPartSelection'),notice=el('p',null,'studioPartNotice'),subtitle=el('select',null,'studioPartSubtitle'),list=el('select',null,'studioPartTarget');
  subtitle.setAttribute('aria-label',tr('字幕を選択','Select subtitle'));list.setAttribute('aria-label',tr('カット・パーツを選択','Select cut or part'));list.size=5;
  status.setAttribute('aria-live','polite');notice.setAttribute('aria-live','polite');panel.append(subtitle,list,status,notice,el('h3',tr('カット・パーツ変形','Cut / part transform')));
  const fields={},resets=[],grid=el('div');grid.className='group-fields';let selected=null,selectionHint=null,drag=null,handles=[],listKey='';
  const target=()=>J.ui.plan.effectTargets?.find(t=>t.id===selected),line=()=>J.ui.plan.lines.find(l=>l.index===target()?.line),current=()=>J.groupTransform(target()?.transform);
  const editable=()=>!!target()&&!target().treatment&&!J.groupLocked(J.ui.project,line())&&!J.ui.playing&&!J.ui.tap&&!J.ui.exporting&&!J.layerSession.busy&&J.studioOn(J.ui.project,'characterEditing');
  const hit=()=>J.effectPartHits.find(h=>h.id===selected);
  const change=t=>{if(!editable())return;selectionHint={...target()};selected=J.setEffectTransform(J.ui.project,target(),t,J.ui.plan);selectionHint.owner=J.ui.project.studio.partTransforms[selected]?.owner;J.studioChanged();sync();};
  for(const [key,ja,en,min,max,step] of /** @type {[string,string,string,number,number,number][]} */([['x','X（%）','X (%)',-400,400,.1],['y','Y（%）','Y (%)',-400,400,.1],['scale','拡大率（%）','Scale (%)',5,1000,1],['rotation','回転（°）','Rotation (°)',-360,360,1]])){
    const label=el('label',tr(ja,en)),input=el('input',null,'studioPart-'+key);input.type='number';input.min=String(min);input.max=String(max);input.step=String(step);input.setAttribute('aria-label',tr(ja,en));label.append(input);grid.append(label);fields[key]=input;
    input.addEventListener('change',()=>{const v=input.valueAsNumber;if(!editable()||!Number.isFinite(v)||v<min||v>max){sync();return;}const t=current();t[key]=key==='rotation'?v:v/100;if(JSON.stringify(t)!==JSON.stringify(current())){J.uiApi.pushEdit();change(t);}else sync();});
  }
  panel.append(grid);const buttons=el('div');buttons.className='group-resets';
  for(const [id,ja,en,patch] of [['position','位置リセット','Reset position',{x:0,y:0}],['scale','拡大率リセット','Reset scale',{scale:1}],['rotation','回転リセット','Reset rotation',{rotation:0}],['all','選択対象の変形をすべてリセット','Reset all transforms of this target',J.groupTransform()]]){
    const button=J.studioButton('studioPartReset-'+id,ja,en,()=>{if(editable()){J.uiApi.pushEdit();change({...current(),...patch});}});resets.push(button);buttons.append(button);
  }
  panel.append(buttons,el('p',tr('一覧選択で該当カットへ移動。カット全体、または内部パーツを選び、ドラッグ・四隅・上の丸で位置・倍率・回転を編集します。X/Yは親座標で画面幅・高さの%です。共通装飾はカット全体に属します。','Select a target to seek to its cut. Drag, use corners, or the top circle to move, scale, or rotate the cut or an internal part. X/Y are % of frame width/height in parent coordinates. Shared decorations belong to the whole cut.')));root.append(panel);
  const overlay=el('canvas',null,'studioPartOverlay');overlay.hidden=true;overlay.setAttribute('aria-label',tr('カット・パーツの選択枠','Cut / part selection'));document.getElementById('viewport').append(overlay);
  function sync(){
    const on=mode.value==='part';panel.hidden=!on;
    if(on)for(const node of root.children)if(node!==mode&&node!==panel&&node.tagName!=='SUMMARY')/** @type {HTMLElement} */(node).hidden=true;
    if(target()&&J.effectTargetDeleted(J.ui.plan,target())){selected=null;selectionHint=null;drag=null;}
    if(!target()&&selectionHint)selected=J.ui.plan.effectTargets?.find(t=>t.signature===selectionHint.signature&&t.kind===selectionHint.kind&&(t.owner===selectionHint.owner||t.line===selectionHint.line))?.id||null;
    const targets=J.ui.plan.effectTargets||[],key=JSON.stringify([targets.map(t=>[t.id,t.line,t.text]),subtitle.value,J.ui.plan.studio.deletedObjects]);
    if(key!==listKey){
      const old=subtitle.value;subtitle.replaceChildren();
      for(const l of J.ui.plan.lines){const o=el('option','#'+(l.index+1)+' '+l.text);o.value=String(l.index);subtitle.append(o);}
      subtitle.value=target()?String(target().line):old;if(!subtitle.value&&subtitle.options.length)subtitle.selectedIndex=0;
      list.replaceChildren();for(const t of targets.filter(t=>String(t.line)===subtitle.value&&!J.effectTargetDeleted(J.ui.plan,t))){
        const label=(t.kind==='part'?'  ↳ ':'')+tr('カット ','Cut ')+t.cutNumber+(t.role==='companion'?' B':'')+(t.kind==='part'?' / '+t.slot:tr(' 全体',' whole'))+'：'+t.text+' ['+(t.id.startsWith('part-')?t.id.slice(-8):J.sid(t.signature).toString(16))+']';
        const o=el('option',label);o.value=t.id;list.append(o);
      }
      listKey=JSON.stringify([targets.map(t=>[t.id,t.line,t.text]),subtitle.value,J.ui.plan.studio.deletedObjects]);
    }
    list.value=selected||'';
    const p=current();for(const key in fields){fields[key].value=String(Math.round((key==='rotation'?p[key]:p[key]*100)*1000)/1000);fields[key].disabled=!editable();}for(const b of resets)b.disabled=!editable();
    const t=target();status.textContent=t?tr('選択：','Selected: ')+t.text+(J.groupLocked(J.ui.project,line())?tr('（ロック中）',' (locked)'):''):tr('一覧またはプレビューで編集対象を選択してください。','Select a target in the list or preview.');
    const suspended=J.ui.plan.suspendedEffectTransforms?.length||0;
    notice.textContent=(suspended?tr('構成変更で対応不明の設定を退避中：','Suspended unmatched settings after topology change: ')+suspended+'. ':'')+(t?.kind==='cut'&&!t.supported?tr('このスタイルは内部パーツ分割未対応です。カット全体は編集できます。','Internal part subdivision is unavailable for this style. The whole cut is editable.'):'');
    if(on)view.style.touchAction=J.studioOn(J.ui.project,'characterEditing')?'none':'';drawOverlay();
  }
  function select(id,seek){
    selected=id;const t=target();selectionHint=t?{...t}:null;if(t){subtitle.value=String(t.line);listKey='';if(seek){J.effectPartHits=[];J.uiApi.seek(t.start+(t.end-t.start)*.65);J.ui.need=true;}}sync();
  }
  subtitle.addEventListener('change',()=>{selected=null;selectionHint=null;listKey='';sync();});list.addEventListener('change',()=>select(list.value,true));
  function drawOverlay(){
    const h=hit();overlay.hidden=mode.value!=='part'||!h||J.ui.playing||J.ui.tap||J.ui.exporting||!J.studioOn(J.ui.project,'characterEditing');
    if(h&&(h.bounds.x1<0||h.bounds.y1<0||h.bounds.x0>view.width||h.bounds.y0>view.height))overlay.hidden=true;
    if(overlay.hidden){handles=[];return;}
    const r=view.getBoundingClientRect(),parent=document.getElementById('viewport').getBoundingClientRect();overlay.width=view.width;overlay.height=view.height;overlay.style.left=(r.left-parent.left)+'px';overlay.style.top=(r.top-parent.top)+'px';overlay.style.width=r.width+'px';overlay.style.height=r.height+'px';
    const ctx=overlay.getContext('2d'),k=view.width/r.width,pad=5*k,b=h.bounds,x=b.x0-pad,y=b.y0-pad,w=b.x1-b.x0+2*pad,height=b.y1-b.y0+2*pad;
    ctx.strokeStyle=J.groupLocked(J.ui.project,line())?'#aab0bd':'#eac67b';ctx.fillStyle='#151b24';ctx.lineWidth=1.5*k;ctx.setLineDash([5*k,3*k]);ctx.strokeRect(x,y,w,height);ctx.setLineDash([]);
    handles=[[x,y],[x+w,y],[x+w,y+height],[x,y+height]].map(([x,y])=>({x,y,type:'scale'}));handles.push({x:x+w/2,y:y-26*k,type:'rotate'});ctx.beginPath();ctx.moveTo(x+w/2,y);ctx.lineTo(x+w/2,y-26*k);ctx.stroke();
    for(const p of handles){ctx.beginPath();if(p.type==='rotate')ctx.arc(p.x,p.y,5*k,0,J.TAU);else ctx.rect(p.x-4*k,p.y-4*k,8*k,8*k);ctx.fill();ctx.stroke();}
  }
  const preview=J.drawLayerPreview;
  J.drawLayerPreview=(ctx,plan,t,opt)=>{
    J.partCapturing=ctx.canvas.id==='view'&&mode.value==='part'&&!J.ui.playing&&J.studioOn(J.ui.project,'characterEditing');if(J.partCapturing)J.effectPartHits=[];
    try{
      const result=preview(ctx,plan,t,opt);
      if(J.partCapturing&&J.studioOn(J.ui.project,'timeline')&&(opt?.simpleSettingsPreview||J.layerSession.preview==='composite')){
        const layer=J.ui.project.studio.layers.find(l=>l.type==='Lyrics'),p=layer?.transform;
        if(!p||p.opacity<=0||t<layer.start||t>=layer.end)J.effectPartHits=[];
        else {const m=J.groupMatrix({x:p.x/plan.W,y:p.y/plan.H,scale:p.scale,rotation:p.rotation},{x:ctx.canvas.width/2,y:ctx.canvas.height/2},ctx.canvas.width,ctx.canvas.height);
          for(const h of J.effectPartHits){const b=h.bounds,points=[[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]].map(([x,y])=>J.groupPoint(m,{x,y}));h.bounds={x0:Math.min(...points.map(p=>p.x)),y0:Math.min(...points.map(p=>p.y)),x1:Math.max(...points.map(p=>p.x)),y1:Math.max(...points.map(p=>p.y))};h.center=J.groupPoint(m,h.center);const basis=J.groupMultiply(m,{...h.basis,e:0,f:0});h.basis={a:basis.a,b:basis.b,c:basis.c,d:basis.d};}
        }
      }
      if(ctx.canvas.id==='view')drawOverlay();return result;
    }finally{J.partCapturing=false;}
  };
  const point=e=>{const r=view.getBoundingClientRect();return{x:(e.clientX-r.left)*view.width/r.width,y:(e.clientY-r.top)*view.height/r.height};};
  view.addEventListener('pointerdown',e=>{
    if(mode.value!=='part'||e.button!==0||J.ui.playing||J.ui.tap||J.ui.exporting||J.layerSession.busy||!J.studioOn(J.ui.project,'characterEditing'))return;
    e.preventDefault();e.stopImmediatePropagation();const p=point(e),r=view.getBoundingClientRect(),radius=12*view.width/r.width,handle=handles.find(h=>Math.hypot(h.x-p.x,h.y-p.y)<=radius);
    const inside=h=>p.x>=Math.max(0,h.bounds.x0)&&p.x<=Math.min(view.width,h.bounds.x1)&&p.y>=Math.max(0,h.bounds.y0)&&p.y<=Math.min(view.height,h.bounds.y1);
    if(!handle&&(!hit()||!inside(hit()))){const h=J.effectPartHits.filter(inside).sort((a,b)=>(a.bounds.x1-a.bounds.x0)*(a.bounds.y1-a.bounds.y0)-(b.bounds.x1-b.bounds.x0)*(b.bounds.y1-b.bounds.y0))[0];select(h?.id||null,false);}
    const h=hit();if(!editable()||!h)return;view.setPointerCapture(e.pointerId);drag={point:p,transform:current(),type:handle?.type||'move',center:h.center,basis:h.basis,started:false};
  },true);
  view.addEventListener('pointermove',e=>{
    if(!drag)return;e.preventDefault();e.stopImmediatePropagation();if(!editable()){drag=null;return;}const p=point(e),dx=p.x-drag.point.x,dy=p.y-drag.point.y;if(!drag.started&&Math.hypot(dx,dy)<1)return;if(!drag.started){J.uiApi.pushEdit();drag.started=true;}
    const t={...drag.transform},b=drag.basis,det=b.a*b.d-b.b*b.c;if(Math.abs(det)<1e-9)return;
    if(drag.type==='move'){t.x+=(b.d*dx-b.c*dy)/det/J.ui.plan.W;t.y+=(-b.b*dx+b.a*dy)/det/J.ui.plan.H;}
    else if(drag.type==='scale'){const a=Math.hypot(drag.point.x-drag.center.x,drag.point.y-drag.center.y);if(a>1)t.scale*=Math.hypot(p.x-drag.center.x,p.y-drag.center.y)/a;}
    else {let a=Math.atan2(p.y-drag.center.y,p.x-drag.center.x)-Math.atan2(drag.point.y-drag.center.y,drag.point.x-drag.center.x);a=Math.atan2(Math.sin(a),Math.cos(a));t.rotation+=a/J.DEG;}change(t);
  },true);
  for(const event of ['pointerup','pointercancel','lostpointercapture'])view.addEventListener(event,()=>{drag=null;});mode.addEventListener('change',()=>{drag=null;sync();J.ui.need=true;});
  const oldSync=J.syncLayerUI;J.syncLayerUI=()=>{oldSync();sync();};
  J.effectPartUI={sync,drawOverlay,select,target};sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
