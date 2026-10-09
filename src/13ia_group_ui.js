/* 選択枠はプレビュー専用Canvas。書き出し描画器には渡さない。 */
(() => {
'use strict';
function boot(){
  const el=J.studioElement,tr=J.layerText,root=document.getElementById('studio-characterEditing'),mode=/** @type {HTMLSelectElement} */(document.getElementById('studioCharacterMode')),view=/** @type {HTMLCanvasElement} */(document.getElementById('view'));
  root.querySelector('summary').textContent=tr('文字・行・演出全体の直接編集','Character / line / group editing');
  const option=el('option',tr('演出全体 / Group','Group'));option.value='group';mode.insertBefore(option,mode.options[1]);
  mode.setAttribute('aria-label',tr('編集対象','Editing target'));
  const panel=el('div',null,'studioGroupPanel'),status=el('p',null,'studioGroupSelection'),hint=el('p',tr('一時停止した字幕演出をクリック。ドラッグで移動、四隅で拡大縮小、上の丸で回転。X/Yは画面幅・高さに対する移動量（%）です。','Pause and click a subtitle group. Drag to move, drag a corner to scale, or the top circle to rotate. X/Y are offsets in % of the frame width/height.'));
  status.setAttribute('aria-live','polite');panel.append(status,el('h3',tr('グループ変形','Group transform')));
  const fields={},resets=[],grid=el('div');grid.className='group-fields';let selected=null,drag=null,handles=[];
  const line=()=>J.ui.plan.lines.find(l=>J.subtitleGroupKey(l)===selected),current=()=>J.groupTransform(J.ui.project.studio.groups?.[selected]);
  const editable=()=>selected&&!J.groupLocked(J.ui.project,line())&&!J.ui.playing&&!J.ui.tap&&!J.ui.exporting&&!J.layerSession.busy&&J.studioOn(J.ui.project,'characterEditing');
  const hit=()=>J.subtitleGroupHits.find(h=>h.key===selected);
  const change=t=>{if(!editable())return;selected=J.setSubtitleGroup(J.ui.project,line(),t);J.studioChanged();sync();};
  for(const [key,ja,en,min,max,step] of /** @type {[string,string,string,number,number,number][]} */([['x','X（%）','X (%)',-400,400,.1],['y','Y（%）','Y (%)',-400,400,.1],['scale','拡大率（%）','Scale (%)',5,1000,1],['rotation','回転（°）','Rotation (°)',-360,360,1]])){
    const label=el('label',tr(ja,en)),input=el('input',null,'studioGroup-'+key);input.type='number';input.min=String(min);input.max=String(max);input.step=String(step);input.setAttribute('aria-label',tr(ja,en));label.append(input);grid.append(label);fields[key]=input;
    input.addEventListener('change',()=>{const v=input.valueAsNumber;if(!editable()||!Number.isFinite(v)||v<min||v>max){sync();return;}const t=current();t[key]=key==='rotation'?v:v/100;if(JSON.stringify(t)!==JSON.stringify(current())){J.uiApi.pushEdit();change(t);}else sync();});
  }
  panel.append(grid);const buttons=el('div');buttons.className='group-resets';
  for(const [id,ja,en,patch] of [['position','位置リセット','Reset position',{x:0,y:0}],['scale','拡大率リセット','Reset scale',{scale:1}],['rotation','回転リセット','Reset rotation',{rotation:0}],['all','グループ変形をすべてリセット','Reset all group transforms',J.groupTransform()]]){
    const button=J.studioButton('studioGroupReset-'+id,ja,en,()=>{if(editable()){J.uiApi.pushEdit();change({...current(),...patch});}});resets.push(button);buttons.append(button);
  }
  panel.append(buttons,hint);root.append(panel);
  const overlay=el('canvas',null,'studioGroupOverlay');overlay.hidden=true;overlay.setAttribute('aria-label',tr('演出全体の選択枠','Subtitle group selection'));document.getElementById('viewport').append(overlay);
  function sync(){
    const group=mode.value==='group';panel.hidden=!group;
    for(const node of root.children)if(node!==mode&&node!==panel&&node.tagName!=='SUMMARY')/** @type {HTMLElement} */(node).hidden=group;
    if(selected&&!line())selected=null;
    const p=current();for(const key in fields){fields[key].value=String(Math.round((key==='rotation'?p[key]:p[key]*100)*1000)/1000);fields[key].disabled=!editable();}
    for(const b of resets)b.disabled=!editable();
    status.textContent=selected?tr('選択字幕：字幕 #','Selected subtitle: #')+String(line().index+1).padStart(2,'0')+(J.groupLocked(J.ui.project,line())?tr('（ロック中）',' (locked)'):''):tr('プレビューの字幕演出を選択してください。','Select a subtitle group in the preview.');
    view.style.touchAction=group&&J.studioOn(J.ui.project,'characterEditing')?'none':'';
    drawOverlay();
  }
  function drawOverlay(){
    overlay.hidden=mode.value!=='group'||!selected||J.ui.playing||J.ui.tap||J.ui.exporting||!J.studioOn(J.ui.project,'characterEditing');
    const h=hit();if(!h)overlay.hidden=true;if(overlay.hidden){handles=[];return;}
    const r=view.getBoundingClientRect(),parent=document.getElementById('viewport').getBoundingClientRect();
    overlay.width=view.width;overlay.height=view.height;overlay.style.left=(r.left-parent.left)+'px';overlay.style.top=(r.top-parent.top)+'px';overlay.style.width=r.width+'px';overlay.style.height=r.height+'px';
    const ctx=overlay.getContext('2d'),k=view.width/r.width,pad=5*k,b=h.bounds,x=b.x0-pad,y=b.y0-pad,w=b.x1-b.x0+2*pad,height=b.y1-b.y0+2*pad;
    ctx.strokeStyle=J.groupLocked(J.ui.project,line())?'#aab0bd':'#79d9ae';ctx.fillStyle='#151b24';ctx.lineWidth=1.5*k;ctx.setLineDash([5*k,3*k]);ctx.strokeRect(x,y,w,height);ctx.setLineDash([]);
    handles=[[x,y],[x+w,y],[x+w,y+height],[x,y+height]].map(([x,y])=>({x,y,type:'scale'}));handles.push({x:x+w/2,y:y-26*k,type:'rotate'});
    ctx.beginPath();ctx.moveTo(x+w/2,y);ctx.lineTo(x+w/2,y-26*k);ctx.stroke();
    for(const p of handles){ctx.beginPath();if(p.type==='rotate')ctx.arc(p.x,p.y,5*k,0,J.TAU);else ctx.rect(p.x-4*k,p.y-4*k,8*k,8*k);ctx.fill();ctx.stroke();}
  }
  const preview=J.drawLayerPreview;
  J.drawLayerPreview=(ctx,plan,t,opt)=>{
    J.groupCapturing=ctx.canvas.id==='view'&&!J.ui.playing&&J.studioOn(J.ui.project,'characterEditing');
    if(J.groupCapturing)J.subtitleGroupHits=[];
    try{
      const result=preview(ctx,plan,t,opt);
      if(J.groupCapturing&&J.studioOn(J.ui.project,'timeline')&&(opt?.simpleSettingsPreview||J.layerSession.preview==='composite')){
        const layer=J.ui.project.studio.layers.find(l=>l.type==='Lyrics'),p=layer?.transform,k=ctx.canvas.width/plan.W;
        if(!p||p.opacity<=0||t<layer.start||t>=layer.end)J.subtitleGroupHits=[];
        else{
          const matrix=J.groupMatrix({x:p.x/plan.W,y:p.y/plan.H,scale:p.scale,rotation:p.rotation},{x:ctx.canvas.width/2,y:ctx.canvas.height/2},ctx.canvas.width,ctx.canvas.height);
          for(const h of J.subtitleGroupHits){const b=h.bounds,points=[[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]].map(([x,y])=>J.groupPoint(matrix,{x,y}));h.bounds={x0:Math.min(...points.map(p=>p.x)),y0:Math.min(...points.map(p=>p.y)),x1:Math.max(...points.map(p=>p.x)),y1:Math.max(...points.map(p=>p.y))};h.center=J.groupPoint(matrix,h.center);h.basis={a:matrix.a*k,b:matrix.b*k,c:matrix.c*k,d:matrix.d*k};}
        }
      }
      if(ctx.canvas.id==='view')drawOverlay();return result;
    }finally{J.groupCapturing=false;}
  };
  const point=e=>{const r=view.getBoundingClientRect();return{x:(e.clientX-r.left)*view.width/r.width,y:(e.clientY-r.top)*view.height/r.height};};
  view.addEventListener('pointerdown',e=>{
    if(mode.value!=='group'||e.button!==0||J.ui.playing||J.ui.tap||J.ui.exporting||J.layerSession.busy||!J.studioOn(J.ui.project,'characterEditing'))return;
    e.preventDefault();e.stopImmediatePropagation();const p=point(e),r=view.getBoundingClientRect(),radius=12*view.width/r.width;
    const handle=handles.find(h=>Math.hypot(h.x-p.x,h.y-p.y)<=radius);
    if(!handle){selected=J.subtitleGroupHits.filter(h=>p.x>=h.bounds.x0-radius&&p.x<=h.bounds.x1+radius&&p.y>=h.bounds.y0-radius&&p.y<=h.bounds.y1+radius).sort((a,b)=>(a.bounds.x1-a.bounds.x0)*(a.bounds.y1-a.bounds.y0)-(b.bounds.x1-b.bounds.x0)*(b.bounds.y1-b.bounds.y0))[0]?.key||null;sync();}
    const h=hit();if(!editable()||!h)return;
    view.setPointerCapture(e.pointerId);drag={point:p,transform:current(),type:handle?.type||'move',center:h.center,basis:h.basis,started:false,pointerId:e.pointerId};
  },true);
  view.addEventListener('pointermove',e=>{
    if(!drag)return;e.preventDefault();e.stopImmediatePropagation();if(!editable()){drag=null;return;}
    const p=point(e),dx=p.x-drag.point.x,dy=p.y-drag.point.y;if(!drag.started&&Math.hypot(dx,dy)<1)return;
    if(!drag.started){J.uiApi.pushEdit();drag.started=true;}
    let t={...drag.transform};const b=drag.basis,det=b.a*b.d-b.b*b.c;if(Math.abs(det)<1e-9)return;
    if(drag.type==='move'){t.x+=(b.d*dx-b.c*dy)/det/J.ui.plan.W;t.y+=(-b.b*dx+b.a*dy)/det/J.ui.plan.H;}
    else if(drag.type==='scale'){const a=Math.hypot(drag.point.x-drag.center.x,drag.point.y-drag.center.y);if(a>1)t.scale*=Math.hypot(p.x-drag.center.x,p.y-drag.center.y)/a;}
    else {let angle=Math.atan2(p.y-drag.center.y,p.x-drag.center.x)-Math.atan2(drag.point.y-drag.center.y,drag.point.x-drag.center.x);angle=Math.atan2(Math.sin(angle),Math.cos(angle));t.rotation+=angle/J.DEG;}
    change(t);
  },true);
  for(const event of ['pointerup','pointercancel','lostpointercapture'])view.addEventListener(event,()=>{drag=null;});
  mode.addEventListener('change',()=>{drag=null;sync();J.ui.need=true;});
  const oldSync=J.syncLayerUI;J.syncLayerUI=()=>{oldSync();sync();};
  J.subtitleGroupUI={sync,drawOverlay};sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
