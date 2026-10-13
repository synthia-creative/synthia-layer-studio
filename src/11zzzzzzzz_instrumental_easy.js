/* UI adapters only. v1 data, generation and rendering remain owned by InstrumentalFX. */
(() => {
'use strict';
const F=J.InstrumentalFX,E=J.InstrumentalEasy={};
E.styles=['Auto','Cyber','Pop','Minimal'];
E.strengths=[25,50,85];
E.reviewTime=(state,effect)=>{
  // Seek to a visible phase of existing flashes rather than changing their renderer.
  const flash=effect.type==='Light Flash'||effect.type==='Transition Accent'&&effect.params.accent==='flash';
  if(!flash)return effect.start+Math.min(.5,(effect.end-effect.start)/2);
  let best=null,level=0;
  for(let t=effect.start+.05;t<Math.min(effect.end,effect.start+8);t+=.05){const event=F.flashEvent(state,effect,t),phase=t-event;if(event<effect.start||phase<=0||phase>=effect.params.duration)continue;const fade=Math.min(1,(t-effect.start)/.3,(effect.end-t)/Math.min(effect.params.fade,(effect.end-effect.start)/2)),value=Math.sin(Math.PI*phase/effect.params.duration)**2*fade;if(value>level){level=value;best=t;}}
  return best;
};
E.prepare=(state,cues,audio)=>{
  if(!Array.isArray(cues)||!cues.length)throw new Error(J.layerText('「SRTを読み込む」から字幕を読み込んでください。字幕の時刻から間奏を見つけます。','Use Import SRT first. Subtitle timings identify the instrumental sections.'));
  if(!audio?.buffer||!(audio.duration>0))throw new Error(J.layerText('音源を読み込んでから自動で追加してください。音源なしの区間設定は詳細設定で行えます。','Load audio before adding automatically. Advanced settings also support sections without audio.'));
  const detected=F.detect(cues,audio.duration,state.minGap,state.boundary);
  // Preserve every saved section, including exclusions and manually adjusted boundaries.
  const regions=[...state.regions,...detected.filter(r=>!state.regions.some(k=>k.id===r.id||k.start<r.end&&k.end>r.start))].sort((a,b)=>a.start-b.start);
  if(!regions.some(r=>r.auto))throw new Error(J.layerText('追加できる間奏区間がありません。SRTの時刻か詳細設定の対象区間を確認してください。','No instrumental section is available. Check SRT timings or target sections in Advanced settings.'));
  return {regions,detectionKey:F.detectionKey(cues,audio.duration,state.minGap,state.boundary)};
};
E.manual=(state,type,time,duration)=>{
  if(!Number.isFinite(time)||time<0||!(duration>0)||time>=duration||duration-time<.01)throw new Error(J.layerText('曲末です。エフェクトを置きたい位置へ再生位置を戻してください。','The playhead is at the song end. Seek back to the position where you want the effect.'));
  const region=state.regions.find(r=>time>=r.start&&time<r.end);
  return {effect:F.effect({type,start:time,end:Math.min(time+3,duration),regionId:region?.id,seed:state.seed}),outside:!region};
};
})();
