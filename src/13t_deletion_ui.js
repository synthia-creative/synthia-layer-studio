/* 選択の所有権とショートカットの入力保護を一箇所で管理する。 */
(() => {
'use strict';
function boot(){
  const el=J.studioElement,tr=J.layerText,mode=document.getElementById('studioCharacterMode'),view=document.getElementById('view');
  view.tabIndex=0;
  const panel=el('details',null,'studioDeletionPanel');panel.className='studio-section';
  panel.append(el('summary',tr('表示削除・オブジェクト一覧','Display deletion / object list')));
  const subtitle=el('select',null,'studioDeleteSubtitle'),list=el('select',null,'studioDeleteTargets'),scope=el('select',null,'studioDeleteScope'),status=el('p',null,'studioDeleteStatus');
  subtitle.setAttribute('aria-label',tr('削除対象の字幕','Subtitle for deletion'));list.setAttribute('aria-label',tr('削除対象（複数選択可）','Objects to delete (multiple selection)'));list.multiple=true;list.size=6;
  scope.setAttribute('aria-label',tr('文字の削除範囲','Character deletion scope'));
  for(const [value,ja,en] of [['object','表示から削除','Delete from display'],['effect','文字の効果だけ削除','Remove character effects only']]){const o=el('option',tr(ja,en));o.value=value;scope.append(o);}
  status.setAttribute('aria-live','polite');panel.append(subtitle,list,scope,status,el('p',tr('Delete / Backspaceで選択だけを表示から削除。Ctrl+Zで戻す、Ctrl+Y / Ctrl+Shift+Zでやり直す。文字の一覧はCtrl / Shiftで複数選択できます。SRT本文・時刻は変更しません。','Delete / Backspace removes only the selection from display. Ctrl+Z undoes; Ctrl+Y / Ctrl+Shift+Z redoes. Ctrl / Shift selects multiple objects in the list. SRT text and timing are retained.')));
  document.getElementById('studio-characterEditing').after(panel);
  let rows=[],listSelection=[],key='',lastProject=null,lastPlan=null;
  const paused=()=>!J.ui.playing&&!J.ui.tap&&!J.ui.exporting&&!J.layerSession.busy&&!J.instrumentalFXUI?.busy();
  const modalOpen=()=>!!document.querySelector('dialog[open]')||[...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].some(e=>e.getClientRects().length>0);
  function selection(){
    if(listSelection.length)return listSelection.map(id=>rows.find(r=>r.id===id)?.target).filter(Boolean);
    if(mode.value==='part'){const t=J.effectPartUI?.target();return t?[{...t}]:[];}
    if(mode.value==='group'){const line=J.subtitleGroupUI?.target();return line?[{kind:'group',line:line.index}]:[];}
    if(['character','line'].includes(mode.value)){
      const hit=J.characterUI?.target(),line=J.ui.plan.lines.find(l=>J.studioLineKey(l)===hit?.key);
      return line?[{kind:mode.value==='line'?'line':scope.value==='effect'?'glyph-effect':'glyph',line:line.index,index:hit.index}]:[];
    }
    if(mode.value==='instrumental'){const fx=J.instrumentalFXUI?.target();return fx?[{kind:'instrumental',id:fx.id,source:fx.source}]:[];}
    return [];
  }
  const candidates=()=>selection().map(t=>t.kind==='glyph'&&scope.value==='effect'?{...t,kind:'glyph-effect'}:t).filter(t=>J.prepareObjectDeletion(J.ui.project,t,J.ui.plan));
  function clear(){listSelection=[];list.value='';J.characterUI?.clear();J.subtitleGroupUI?.clear();J.effectPartUI?.select(null,false);J.instrumentalFXUI?.clear();}
  function remove(){
    if(!paused()||modalOpen())return;
    const targets=candidates();if(!targets.length)return;
    if(targets.length>20&&!confirm(tr('選択した'+targets.length+'件を表示から削除します。Undoで復元できます。','Delete '+targets.length+' selected objects from display? Undo restores them.')))return;
    J.uiApi.pushEdit();for(const t of targets)J.deleteSelectedObject(J.ui.project,t,J.ui.plan);
    clear();J.studioChanged();sync();J.uiApi.toast(tr('選択を表示から削除しました。Ctrl+Zで復元できます。','Selection removed from display. Ctrl+Z restores it.'));
  }
  const button=J.studioButton('studioDeleteSelected','🗑 削除','🗑 Delete',remove);button.title=tr('選択だけを表示から削除（Delete / Backspace）','Remove only the selection from display (Delete / Backspace)');
  document.getElementById('btnUndoEdit').parentElement.append(button);
  function sync(){
    if(lastProject!==J.ui.project){lastProject=J.ui.project;listSelection=[];key='';clear();}
    const enabled=J.studioOn(J.ui.project,'characterEditing');panel.hidden=!enabled;
    const plan=J.ui.plan,old=subtitle.value,subkey=JSON.stringify(plan.lines.map(l=>[l.index,l.text]));
    if(subtitle.dataset.key!==subkey){subtitle.replaceChildren(...plan.lines.map(l=>{const o=el('option','#'+(l.index+1)+' '+l.text);o.value=String(l.index);return o;}));subtitle.value=old;if(!subtitle.value&&subtitle.options.length)subtitle.selectedIndex=0;subtitle.dataset.key=subkey;}
    const line=plan.lines.find(l=>String(l.index)===subtitle.value),next=JSON.stringify([line?.index,line?.text,plan.studio.deletedObjects,plan.effectTargets.filter(t=>t.line===line?.index).map(t=>t.id)]);
    if(key!==next){
      rows=[];if(line){
        const records=J.deletionRecords(plan,line),hidden=new Set(records.filter(r=>r.kind==='glyph').flatMap(r=>r.indices)),whole=records.some(r=>['line','group'].includes(r.kind));
        if(!whole){
          rows.push({id:'line-'+line.index,label:tr('行全体：','Whole line: ')+line.text,target:{kind:'line',line:line.index}},{id:'group-'+line.index,label:tr('演出グループ全体：','Whole effect group: ')+line.text,target:{kind:'group',line:line.index}});
          let i=0;for(const cluster of new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(line.text.replace(/\r?\n/g,''))){const index=i;i+=[...cluster.segment].length;if(/\s/.test(cluster.segment)||hidden.has(index))continue;rows.push({id:'glyph-'+line.index+'-'+index,label:tr('文字 ','Character ')+(index+1)+'：'+cluster.segment,target:{kind:'glyph',line:line.index,index}});}
          for(const t of plan.effectTargets.filter(t=>t.line===line.index&&!J.effectTargetDeleted(plan,t)))rows.push({id:t.id,label:tr('カット ','Cut ')+t.cutNumber+(t.role==='companion'?' B':'')+' / '+t.slot+'：'+t.text,target:{...t}});
        }
      }
      listSelection=listSelection.filter(id=>rows.some(r=>r.id===id));list.replaceChildren(...rows.map(r=>{const o=el('option',r.label);o.value=r.id;o.selected=listSelection.includes(r.id);return o;}));key=next;
    }
    const chosen=selection(),onlyGlyph=chosen.length&&chosen.every(t=>['glyph','glyph-effect'].includes(t.kind));scope.disabled=!enabled||!onlyGlyph;if(!onlyGlyph)scope.value='object';
    const targets=candidates();button.disabled=!paused()||!targets.length||(!enabled&&mode.value!=='instrumental');
    status.textContent=targets.length?tr('削除対象：','Selected for deletion: ')+targets.length:tr('プレビューまたは一覧で対象を選択してください。','Select an object in the preview or list.');
    // 再計画で削除済みの選択枠とヒット座標が残らないようにする。
    if(lastPlan!==plan){lastPlan=plan;J.studioGlyphHits=[];J.effectPartHits=[];J.subtitleGroupHits=[];J.ui.need=true;}
  }
  subtitle.addEventListener('change',()=>{listSelection=[];key='';sync();});list.addEventListener('change',()=>{listSelection=[...list.selectedOptions].map(o=>o.value);J.characterUI?.clear();J.subtitleGroupUI?.clear();J.effectPartUI?.select(null,false);sync();});scope.addEventListener('change',sync);
  mode.addEventListener('change',()=>{listSelection=[];list.value='';sync();});view.addEventListener('pointerdown',()=>{view.focus({preventScroll:true});listSelection=[];list.value='';queueMicrotask(sync);},true);document.getElementById('studioPartTarget').addEventListener('change',()=>{listSelection=[];sync();});
  document.addEventListener('pointerup',e=>{if(e.target===view)sync();},true);
  document.addEventListener('keydown',e=>{
    if(e.defaultPrevented||e.isComposing||e.repeat||modalOpen()||!paused())return;
    const input=e.target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'),objectList=input&&[list,document.getElementById('studioPartTarget'),document.getElementById('ifxEffect')].includes(input);if(input&&!objectList)return;
    if(objectList&&(e.ctrlKey||e.metaKey)&&['KeyZ','KeyY'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();J.uiApi.edGo(e.code==='KeyY'||e.shiftKey?1:-1);return;}
    if(e.ctrlKey||e.metaKey||e.altKey||!['Delete','Backspace'].includes(e.key)||button.disabled)return;
    e.preventDefault();e.stopImmediatePropagation();remove();
  },true);
  const old=J.syncLayerUI;J.syncLayerUI=()=>{old();sync();};
  J.deletionUI={sync,selection,clear,remove};sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
