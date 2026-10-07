(() => {
'use strict';
const el=J.studioElement,tr=J.layerText;
function boot(){
 const root=J.studioSection('characterEditing','文字・行の直接編集','Character / line editing'),mode=el('select',null,'studioCharacterMode');for(const [v,t]of[['off','選択を解除 / Off'],['line','行 / Line'],['character','文字 / Character']]){const o=el('option',t);o.value=v;mode.append(o);}root.append(mode);
 const status=el('p',tr('一時停止したプレビューの文字をクリックして選択します。','Pause the preview and click a glyph to select it.'),'studioCharacterSelection');root.append(status);
 const fields={};let selected=null,drag=null;
 for(const [key,label,min,max,step]of[['x','X',-10000,10000,1],['y','Y',-10000,10000,1],['scale','Scale',.05,10,.05],['rotation','Rotation',-360,360,1],['opacity','Opacity',0,1,.05],['kerning','Kerning',-500,500,1]]){const labelEl=el('label',String(label)),input=el('input',null,'studioChar-'+key);input.type='number';input.min=String(min);input.max=String(max);input.step=String(step);fields[key]=input;labelEl.append(input);root.append(labelEl);input.addEventListener('change',()=>{if(!selected)return;J.uiApi.pushEdit();const t=current();t[key]=+input.value;set(t);});}
 const current=()=>{if(!selected)return J.studioTransform();const row=J.ui.project.studio.characters[selected.key];return J.studioTransform(mode.value==='line'?row?.line:row?.glyphs[selected.index]);};
 const set=t=>{if(!selected)return;const chars=J.ui.project.studio.characters,row=chars[selected.key]||(chars[selected.key]={line:J.studioTransform(),glyphs:{}});if(mode.value==='line')row.line=J.studioTransform(t);else row.glyphs[selected.index]=J.studioTransform(t);J.studioChanged();sync();};
 const sync=()=>{const t=current();for(const k in fields){fields[k].value=String(t[k]);fields[k].disabled=!selected;}status.textContent=selected?`${selected.key} / ${selected.index+1} / ${selected.ch}`:tr('プレビューの文字を選択してください。','Select a preview glyph.');};
 root.append(J.studioButton('studioCharReset','選択の変形をリセット','Reset selected transform',()=>{if(selected){J.uiApi.pushEdit();set(J.studioTransform());}}));
 const preview=J.drawLayerPreview;J.drawLayerPreview=(ctx,plan,t,opt)=>{J.studioCapturing=ctx.canvas.id==='view'&&J.studioOn(J.ui.project,'characterEditing');if(J.studioCapturing)J.studioGlyphHits=[];try{return preview(ctx,plan,t,opt);}finally{J.studioCapturing=false;}};
 const canvas=/** @type {HTMLCanvasElement} */(document.getElementById('view'));const point=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};};
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0||mode.value==='off'||!J.studioOn(J.ui.project,'characterEditing')||J.ui.playing||J.ui.tap||J.layerSession.busy)return;const p=point(e),hits=J.studioGlyphHits.filter(h=>Math.abs(h.x-p.x)<=h.w/2+6&&Math.abs(h.y-p.y)<=h.h/2+6).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));selected=hits[0]||null;sync();if(!selected)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);J.uiApi.pushEdit();drag={point:p,transform:current(),ratio:J.ui.plan.W/canvas.width};});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;const p=point(e);set({...drag.transform,x:drag.transform.x+(p.x-drag.point.x)*drag.ratio,y:drag.transform.y+(p.y-drag.point.y)*drag.ratio});});
 for(const event of['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{drag=null;});mode.addEventListener('change',()=>{selected=null;sync();});sync();J.syncLayerUI();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
