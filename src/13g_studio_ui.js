/* Extensions use the existing editor API; disabling a feature restores legacy tools. */
(() => {
'use strict';
// IDs include legacy controls; explicit element constructors below stay typed.
const $ = id => /** @type {any} */ (document.getElementById(id)), tr = J.layerText;
const labels = {tapSync:['Tap Sync拡張','Enhanced Tap Sync'],lyricsTiming:['歌詞・SRT / LRC','Lyrics / SRT / LRC'],characterEditing:['文字単位編集','Character editing'],advancedFont:['フォントファイル','Font files'],musicAnalysis:['楽曲解析','Music analysis'],autoMotion:['楽曲・フルおまかせ','Music / Full Auto'],timeline:['追加トラック・レイヤー','Extra tracks / layers'],export:['追加書き出し','Additional exports'],autosave:['自動保存・復元','Autosave / recovery']};
J.studioElement = (tag, text, id) => { const e=document.createElement(tag); if(text!=null)e.textContent=text;if(id)e.id=id;return e; };
J.studioButton = (id, ja, en, action) => {const e=J.studioElement('button',tr(ja,en),id);e.type='button';e.addEventListener('click',()=>{if(J.ui.exporting||J.layerSession.busy)return;try{const result=action();if(result?.catch)result.catch(error=>J.uiApi.toast(error.message));}catch(error){J.uiApi.toast(error.message);}});return e;};
J.studioChanged = () => {J.uiApi.syncUI();J.uiApi.replan();J.uiApi.flushSave();};
J.studioSection = (flag, ja, en) => {const section=J.studioElement('details',null,'studio-'+flag);section.className='studio-section';section.append(J.studioElement('summary',tr(ja,en)));$('studioTools').append(section);return section;};
function boot(){
 const panel=J.studioElement('section',null,'studioTools');panel.className='studio-tools';panel.append(J.studioElement('h2',tr('統合制作ツール','Integrated studio tools')),J.studioElement('p',tr('必要な拡張を有効にしてください。従来の編集・MP4出力はそのまま使えます。','Enable the tools you need. Existing editing and MP4 exports stay available.')));
 const flags=J.studioElement('details',null,'studioFlags');flags.append(J.studioElement('summary',tr('拡張のオン／オフ','Enable / disable extensions')));
 for(const key of J.STUDIO_FEATURES){const label=J.studioElement('label'),input=J.studioElement('input',null,'studioFlag-'+key);input.type='checkbox';input.addEventListener('change',()=>{J.uiApi.pushEdit();J.ui.project.studio.flags[key]=input.checked;if(key==='tapSync'&&J.ui.tap)J.uiApi.stopTap();J.studioChanged();});label.append(input,document.createTextNode(tr(...labels[key])));flags.append(label);}
 panel.append(flags);document.querySelector('.col-left').append(panel);
 const gapLabel=J.studioElement('label',tr('次行までの余白（ms）','Gap before next line (ms)')),gap=J.studioElement('input',null,'studioTapGap');gap.type='number';gap.min='0';gap.max='1000';gap.step='50';gap.setAttribute('list','studioTapGaps');const presets=J.studioElement('datalist',null,'studioTapGaps');for(const value of [0,50,100,150]){const option=J.studioElement('option');option.value=String(value);presets.append(option);}gap.addEventListener('change',()=>{if(!Number.isFinite(gap.valueAsNumber)||gap.valueAsNumber<0||gap.valueAsNumber>1000)return;J.uiApi.pushEdit();J.ui.project.studio.tapGap=gap.valueAsNumber;J.studioChanged();});gapLabel.append(gap,presets);panel.append(gapLabel);
 const meta=J.studioElement('div',null,'studioTapMeta');meta.setAttribute('aria-live','polite');$('tapBtn').before(meta);$('tapBtn').setAttribute('aria-label',tr('現在行を打刻','Stamp current lyric'));
 const oldSync=J.syncLayerUI;J.syncLayerUI=()=>{oldSync();sync();};
 function sync(){const studio=J.ui.project.studio||(J.ui.project.studio=J.normalizeStudio());for(const key of J.STUDIO_FEATURES){$('studioFlag-'+key).checked=studio.flags[key];const section=$('studio-'+key);if(section)section.hidden=!studio.flags[key];}gapLabel.hidden=!studio.flags.tapSync;gap.value=String(studio.tapGap);document.documentElement.classList.toggle('studio-tap-enhanced',studio.flags.tapSync);}
 function tapInfo(){if(!J.ui.tap||!J.studioOn(J.ui.project,'tapSync')){meta.hidden=true;return;}meta.hidden=false;const {i,done}=J.ui.tap,lines=J.ui.plan.lines;meta.textContent=tr(`現在 ${Math.min(i+1,lines.length)} / ${lines.length} · 打刻済み ${done.length} · 残り ${Math.max(0,lines.length-i)}\n♪ ${J.ui.t.toFixed(3)}秒\n次: ${lines[i+1]?.text||'—'}`,`Line ${Math.min(i+1,lines.length)} / ${lines.length} · Stamped ${done.length} · Remaining ${Math.max(0,lines.length-i)}\n♪ ${J.ui.t.toFixed(3)}s\nNext: ${lines[i+1]?.text||'—'}`);$('tapBtn').disabled=i>=lines.length;}
 setInterval(tapInfo,100);sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
