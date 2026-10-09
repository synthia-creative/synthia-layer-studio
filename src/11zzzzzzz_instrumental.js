/* Instrumental FX v1: project data and pure, time-addressed Canvas rendering. */
(() => {
'use strict';
const F = J.InstrumentalFX = { version: 1, maxEffects: 1024, maxActive: 20 };
const n = (v,d,lo=0,hi=86400) => Number.isFinite(v) ? Math.max(lo,Math.min(hi,v)) : d;
const copy = v => JSON.parse(JSON.stringify(v));
F.types = ['Particle Burst','Light Flash','Geometry Motion','Audio Pulse','Light Trails','Transition Accent'];
F.styles = ['Auto','Cyber','Pop','Cinematic','Rock','Minimal'];
F.patterns = ['Balanced','Rhythm','Ambient'];
F.hash = v => { let h=2166136261; for(const c of String(v)) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; };
F.random = (seed,i) => { let h=F.hash(seed+':'+i); h=Math.imul(h^(h>>>16),2246822507); h=Math.imul(h^(h>>>13),3266489909); return ((h^(h>>>16))>>>0)/4294967296; };
F.id = () => 'ifx-'+(globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
const id = v => typeof v==='string' && /^[-\w]{1,100}$/.test(v);
const color = v => /^#[0-9a-f]{6}$/i.test(v) ? v : '#79d9ae';
// All type-specific parameters are bounded, including hostile project JSON.
F.paramSpecs = {
  count:[24,1,160], velocity:[.35,0,2], size:[.014,.001,.15], lifetime:[1.2,.1,6], direction:[0,-360,360], spread:[360,0,360], beatResponse:[.6,0,1],
  brightness:[.35,0,1], duration:[.8,.2,6], fade:[.5,.05,4], range:[.18,.02,1], sensitivity:[1,0,4],
  lineWidth:[.004,.0005,.04], rotationSpeed:[30,-360,360], travel:[.18,0,1], zoom:[.3,0,2], pulse:[.65,0,1],
  length:[.35,.02,1], glow:[.3,0,1]
};
F.params = v => ({...Object.fromEntries(Object.entries(F.paramSpecs).map(([k,[d,lo,hi]])=>[k,n(v?.[k],d,lo,hi)])), shape:['circle','square','triangle','line'].includes(v?.shape)?v.shape:'circle', accent:['flash','converge','gather','diffuse'].includes(v?.accent)?v.accent:'converge'});
F.effect = (v={},source='manual') => {
  const start=n(v.start,0,0,86399.99),end=n(v.end,start+3,start+.01,86400);
  return {id:id(v.id)?v.id:F.id(),source,regionId:id(v.regionId)?v.regionId:'',type:F.types.includes(v.type)?v.type:F.types[0],name:String(v.name||v.type||F.types[0]).slice(0,100),start,end,
    x:n(v.x,.5,-2,3),y:n(v.y,.5,-2,3),scale:n(v.scale,1,.05,10),rotation:n(v.rotation,0,-360,360),opacity:n(v.opacity,.65,0,1),color:color(v.color),
    blend:J.STUDIO_BLENDS.includes(v.blend)?v.blend:'screen',speed:n(v.speed,1,.05,5),intensity:n(v.intensity,.5,0,1),beat:v.beat!==false,
    plane:v.plane==='front'?'front':'back',visible:v.visible!==false,locked:v.locked===true,seed:n(v.seed,12345,0,4294967295)>>>0,presetId:id(v.presetId)?v.presetId:'',params:F.params(v.params)};
};
F.regions = v => { const used=new Set();return (Array.isArray(v)?v:[]).slice(0,1000).filter(r=>r&&Number.isFinite(r.start)&&Number.isFinite(r.end)&&r.start>=0&&r.end>r.start&&r.start<86400).flatMap(r=>{
  const key=id(r.id)?r.id:'region-'+F.hash([r.start,r.end,r.type]);if(used.has(key))return[];used.add(key);return [{id:key,name:String(r.name||r.type||'Custom').slice(0,100),start:n(r.start,0),end:n(r.end,1),type:['Intro','Interlude','Outro','Custom'].includes(r.type)?r.type:'Custom',auto:r.auto!==false,edited:r.edited===true}];}); };
F.analysis = v => {
  if(!v||typeof v.key!=='string'||!Number.isFinite(v.duration)||v.duration<=0)return null;
  const array=(a,cap)=>Array.isArray(a)||ArrayBuffer.isView(a)?Array.from(a.slice(0,cap)):[];
  const rate=n(v.rate,5,.1,50),energy=array(v.energy,120000).map(x=>n(x,0,0,1)),onset=array(v.onset,120000).map(x=>n(x,0,0,1));
  return {key:v.key.slice(0,100),duration:n(v.duration,1),rate,energy,onset,beats:array(v.beats,200000).filter(x=>Number.isFinite(x)&&x>=0&&x<v.duration).sort((a,b)=>a-b),bpm:n(v.bpm,120,0,400)};
};
F.normalize = v => {
  const identities=new Set();
  const effects=(rows,source,snapshot=false)=>{const used=new Set(),scope=snapshot?new Set():identities;return(Array.isArray(rows)?rows:[]).slice(0,F.maxEffects/2).filter(e=>e&&id(e.id)&&!used.has(e.id)&&(used.add(e.id),true)).map(e=>{const effect=F.effect(e,source);if(scope.has(effect.id))effect.id=source+'-'+F.hash(effect.id);scope.add(effect.id);return effect;});};
  return {version:1,enabled:v?.enabled===true,auto:v?.auto===true,manual:v?.manual===true,preview:v?.preview!==false,beat:v?.beat!==false,avoidPeople:v?.avoidPeople!==false,safeFlash:v?.safeFlash!==false,
    duration:n(v?.duration,30,.01,86400),strength:n(v?.strength,50,0,100),minGap:n(v?.minGap,2,.1,120),boundary:n(v?.boundary,.1,0,1),style:F.styles.includes(v?.style)?v.style:'Auto',pattern:F.patterns.includes(v?.pattern)?v.pattern:'Balanced',seed:n(v?.seed,12345,0,4294967295)>>>0,
    snap:v?.snap===true,quality:['low','standard','high'].includes(v?.quality)?v.quality:'standard',regions:F.regions(v?.regions),autoEffects:effects(v?.autoEffects,'auto'),manualEffects:effects(v?.manualEffects,'manual'),analysis:F.analysis(v?.analysis),
    detectionKey:String(v?.detectionKey||'').slice(0,100),presets:(Array.isArray(v?.presets)?v.presets:[]).slice(0,100).filter(p=>p&&id(p.id)).map(p=>({id:p.id,name:String(p.name||'Preset').slice(0,100),effect:F.effect(p.effect)})),
    beforeGeneration:Array.isArray(v?.beforeGeneration)?effects(v.beforeGeneration,'auto',true):null};
};
F.timelineInput = (project,plan) => Array.isArray(project.subtitleCues) ? project.subtitleCues : (plan?.lines||[]).map(l=>({...l,end:l.visEnd??l.end}));
F.isLyric = c => !c.filler && !c.interlude && !!String(c.text||'').trim() && !/^\[\s*(?:間奏|间奏|interlude|instrumental|inst|intro|outro|간주)(?:\s*[:：]?\s*\d+(?:\.\d+)?\s*(?:s|sec|秒|초)?)?\s*\]$/i.test(String(c.text).trim());
F.detectionKey = (cues,duration,minGap,boundary) => String(F.hash(JSON.stringify([cues.filter(F.isLyric).map(c=>[c.start,c.end,c.text]),duration,minGap,boundary])));
F.detect = (cues,duration,minGap=2,boundary=.1) => {
  if(!(duration>0))return [];
  const intervals=cues.filter(F.isLyric).filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start).map(c=>({start:Math.max(0,c.start-boundary),end:Math.min(duration,c.end+boundary)})).filter(c=>c.end>c.start).sort((a,b)=>a.start-b.start),union=[];
  for(const r of intervals){const last=union.at(-1);if(last&&r.start<=last.end)last.end=Math.max(last.end,r.end);else union.push({...r});}
  const out=[],add=(start,end,type)=>{if(end-start+1e-9>=minGap)out.push({id:'region-'+F.hash([+start.toFixed(4),+end.toFixed(4),type]),name:type+' '+(out.length+1),start:+start.toFixed(4),end:+end.toFixed(4),type,auto:true,edited:false});};
  if(!union.length){add(0,duration,'Custom');return out;}
  add(0,union[0].start,'Intro');for(let i=1;i<union.length;i++)add(union[i-1].end,union[i].start,'Interlude');add(union.at(-1).end,duration,'Outro');return out;
};
// Re-detection is staged by the UI. Acceptance retains manual rows; conflicts are explicit.
F.reconcile = (previous,detected) => {
  const keep=previous.filter(r=>r.edited),conflicts=[];
  const next=detected.filter(r=>{if(keep.some(k=>k.start<r.end&&k.end>r.start)){conflicts.push(r);return false;}return true;});
  return {regions:[...keep,...next].sort((a,b)=>a.start-b.start),conflicts};
};
F.audioKey = audio => { const b=audio?.buffer;if(!b)return '';const a=b.getChannelData(0);let s=b.length+':'+b.sampleRate+':'+b.numberOfChannels;for(let i=0;i<128;i++)s+=':'+Math.round((a[Math.floor(i*a.length/128)]||0)*100000);return String(F.hash(s)); };
F.sample = (analysis,t,key='energy') => analysis?.[key]?.[Math.max(0,Math.min(analysis[key].length-1,Math.floor(t*analysis.rate)))]||0;
F.lastBeat = (beats,t) => {let a=0,b=beats.length;while(a<b){const m=(a+b)>>>1;if(beats[m]<=t)a=m+1;else b=m;}return a-1;};
F.snapTime = (t,analysis,on) => {if(!on||!analysis?.beats?.length)return Math.max(0,t);const i=F.lastBeat(analysis.beats,t),a=analysis.beats[Math.max(0,i)],b=analysis.beats[i+1]??a;return Math.abs(a-t)<Math.abs(b-t)?a:b;};
F.compactAnalysis = async (audio,signal) => {
  const a=J.studioAnalyze(audio),duration=audio.duration,rate=Math.min(10,120000/duration),energy=[],onset=[];
  for(let i=0;i<Math.ceil(duration*rate);i++){
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    const lo=Math.floor(i*a.rate/rate),hi=Math.min(a.energy.length,Math.ceil((i+1)*a.rate/rate));let e=0,o=0;
    for(let j=lo;j<hi;j++){e=Math.max(e,a.energy[j]||0);o=Math.max(o,a.onset[j]||0);}
    energy.push(+e.toFixed(4));onset.push(+Math.min(1,o).toFixed(4));if(i%2048===0)await new Promise(r=>setTimeout(r,0));
  }
  return F.analysis({key:F.audioKey(audio),duration,rate,energy,onset,beats:a.confidence==='low'?[]:a.beats,bpm:a.bpm});
};
F.styleData = {Cyber:{colors:['#79d9ae','#65cfff','#cc77ff'],speed:1.2,density:1},Pop:{colors:['#ffcf65','#ff7da9','#73d4ff'],speed:1,density:.9},Cinematic:{colors:['#e7cda3','#93b7d4'],speed:.45,density:.5},Rock:{colors:['#ff795b','#fff0bc'],speed:1.4,density:1},Minimal:{colors:['#b9d3db'],speed:.5,density:.25}};
F.placement = (effect,video,project) => {
  const V=J.VideoAnalysis,result=video?.result;if(!video?.valid||!result||!V)return null;
  const size=Math.min(.3,effect.params.range),fit=V.fit(result.source,...J.designSize(project.aspect));
  const candidates=V.evaluateSafe(result,project.videoAnalysis?.regions||[],effect,{x:.5-size/2,y:.5-size/2,w:size,h:size},.5);
  const best=candidates.find(c=>c.covered&&c.faceRisk<.02&&c.personRisk<.2&&c.manualRisk===0);
  if(!best)return null;const r=V.toProject(best.rect,fit);return {x:r.x+r.w/2,y:r.y+r.h/2};
};
F.generate = async (state,regions,analysis,project,video,signal) => {
  const out=[],strength=state.strength/100;if(!strength)return out;
  const mean=(analysis?.energy||[]).reduce((a,b)=>a+b,0)/Math.max(1,analysis?.energy?.length||0),style=state.style==='Auto'?(mean>.7?'Rock':mean>.4?'Pop':'Cinematic'):state.style,preset=F.styleData[style];
  let previous='';for(const region of regions.filter(r=>r.auto)){
    const beats=state.beat?(analysis?.beats||[]).filter(t=>t>=region.start&&t<region.end):[],step=state.pattern==='Ambient'?6:state.pattern==='Rhythm'?2:4;
    const times=state.pattern==='Rhythm'&&beats.length?beats.filter((t,i)=>i%Math.max(1,Math.round(3-strength*2))===0):Array.from({length:Math.min(512,Math.ceil((region.end-region.start)/step))},(_,i)=>region.start+i*step);
    for(let i=0;i<times.length;i++){
      if(signal?.aborted)throw new DOMException('Cancelled','AbortError');if(out.length>=512)throw new Error(J.layerText('自動FXは512件までです。区間を短くするかAmbientを選択してください。','Auto FX limit: 512. Use shorter sections or Ambient.'));
      const seed=F.hash(state.seed+':'+region.id+':'+i),r=F.random(seed,0),pool=state.pattern==='Ambient'?[3,4,2]:state.pattern==='Rhythm'?[0,3,1]:[0,2,4,1,3,5];
      let type=F.types[pool[Math.floor(r*pool.length)]];if(type===previous)type=F.types[pool[(pool.indexOf(F.types.indexOf(type))+1)%pool.length]];previous=type;
      const start=times[i],end=Math.min(region.end,start+(state.pattern==='Rhythm'?1.6:step+1));if(end-start<.05)continue;
      const e=F.effect({id:'auto-'+seed,regionId:region.id,type,start,end,seed,x:.15+F.random(seed,1)*.7,y:.15+F.random(seed,2)*.7,color:preset.colors[i%preset.colors.length],intensity:strength,opacity:.25+strength*.4,speed:preset.speed,
        params:{count:Math.round(12+50*strength*preset.density),shape:['circle','square','triangle','line'][i%4],range:.14,size:.015,lifetime:1.2,velocity:.25*preset.speed,spread:360,accent:['converge','gather','diffuse','flash'][i%4]}},'auto');
      const palette=project?.colors?.enabled?project.colors.palette:null,scheme=palette?.[i%palette.length],themeColor=scheme?.accent||scheme?.ink||project?.colors?.accent;
      if(/^#[0-9a-f]{6}$/i.test(themeColor))e.color=themeColor;
      if(state.avoidPeople){const p=F.placement(e,video,project);if(p)Object.assign(e,p);}
      // Fillers remain intact; their drawing intervals lower the generated visual density.
      if((project.subtitleCues||[]).some(c=>c.filler&&c.start<e.end&&c.end>e.start)){e.opacity*=.45;e.params.count=Math.min(16,e.params.count);}
      out.push(e);if(out.length%16===0)await new Promise(r=>setTimeout(r,0));
    }
  }return out;
};
F.updateEffect = (state,id,patch) => {for(const key of ['autoEffects','manualEffects']){const i=state[key].findIndex(e=>e.id===id);if(i<0)continue;const e=state[key][i];if(e.locked&&Object.keys(patch).some(k=>k!=='locked'))throw new Error(J.layerText('ロックを解除してください。','Unlock this effect first.'));state[key][i]=F.effect({...e,...patch,params:{...e.params,...patch.params}},e.source);return state[key][i];}return null;};
F.active = (state,t,plane,preview=false) => !state?.enabled||preview&&!state.preview?[]:[...(state.auto?state.autoEffects:[]),...(state.manual?state.manualEffects:[])].filter(e=>e.visible&&e.plane===plane&&t>=e.start&&t<e.end).slice(0,F.maxActive);
F.pulse = (state,e,t) => {
  const a=state.analysis,beat=e.beat&&(e.source!=='auto'||state.beat),i=beat?F.lastBeat(a?.beats||[],t):-1,last=i>=0?a.beats[i]:-Infinity;
  return {energy:F.sample(a,t),value:beat?Math.exp(-Math.max(0,t-last)/Math.max(.05,e.params.fade)):0};
};
F.flashEvent = (s,e,t) => {
  const period=s.safeFlash?Math.max(1,e.params.duration+.4):Math.max(.4,e.params.duration),beats=e.beat&&(e.source!=='auto'||s.beat)?s.analysis?.beats||[]:[],index=F.lastBeat(beats,t),stride=Math.max(1,Math.ceil(period*(s.analysis?.bpm||120)/60));
  const candidate=index>=0?beats[index-index%stride]:e.start+Math.floor((t-e.start)/period)*period;
  // Irregular / imported beat grids must not bypass the minimum flash spacing.
  return s.safeFlash&&candidate>=e.start?e.start+Math.floor((candidate-e.start)/period+1e-9)*period:candidate;
};
F.draw = (ctx,project,t,plane='back',preview=false) => {
  const s=project.studio?.instrumentalFx,list=F.active(s,t,plane,preview);if(!list.length)return;
  const w=ctx.canvas.width,h=ctx.canvas.height,short=Math.min(w,h),reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
  const flashCount=Math.max(1,list.filter(e=>e.type==='Light Flash'||e.type==='Transition Accent'&&e.params.accent==='flash').length);
  for(const e of list){const p=e.params,u=t-e.start,d=e.end-e.start,fade=Math.min(1,u/Math.min(.3,d/2),(d-u)/Math.min(p.fade,d/2)),pulse=F.pulse(s,e,t),clock=u*e.speed*(reduced?.25:1),seed=e.seed,rand=i=>F.random(seed,i),angle=p.direction*J.DEG;
    const extent=short*e.scale*(p.range+p.travel+p.velocity*p.lifetime+p.length+.3)*2;
    if(e.x*w+extent<0||e.x*w-extent>w||e.y*h+extent<0||e.y*h-extent>h)continue;
    ctx.save();ctx.translate(e.x*w,e.y*h);ctx.rotate(e.rotation*J.DEG);ctx.scale(e.scale,e.scale);ctx.globalCompositeOperation=e.blend;
    const opacity=e.opacity*(.25+.75*e.intensity);
    ctx.globalAlpha=opacity*fade;ctx.fillStyle=ctx.strokeStyle=e.color;ctx.lineWidth=short*p.lineWidth;ctx.lineCap='round';
    const count=Math.min(s.quality==='low'?40:s.quality==='high'?160:90,Math.round(p.count)),reaction=1+p.beatResponse*pulse.value;
    if(e.type==='Particle Burst'){
      const beatTimes=e.beat&&(e.source!=='auto'||s.beat)?s.analysis?.beats||[]:[],ix=F.lastBeat(beatTimes,t);let events=[];
      for(let j=ix;j>=0&&events.length<8&&beatTimes[j]>=Math.max(e.start,t-p.lifetime/e.speed);j--)events.push(beatTimes[j]);
      if(!events.length)events=[e.start+Math.floor(u/(reduced?4:2))* (reduced?4:2)];
      for(const event of events){const age=(t-event)*e.speed;if(age<0||age>p.lifetime)continue;const life=1-age/p.lifetime;
        for(let i=0;i<count;i++){const a=angle+(rand(i*3)-.5)*p.spread*J.DEG,v=(.3+rand(i*3+1))*(reduced?.12:1)*p.velocity*short*reaction,dist=age*v;ctx.globalAlpha=opacity*fade*life;ctx.beginPath();ctx.arc(Math.cos(a)*dist,Math.sin(a)*dist+age*age*short*.025,short*p.size*(.3+rand(i*3+2)),0,J.TAU);ctx.fill();}}
    }else if(e.type==='Light Flash'||e.type==='Transition Accent'&&p.accent==='flash'){
      // Minimum one-second spacing plus a smooth envelope; safety caps total brightness and area.
      const event=F.flashEvent(s,e,t),phase=t-event,level=event>=e.start&&phase<p.duration?Math.sin(Math.PI*phase/p.duration)**2:0;
      const radius=short*(s.safeFlash?Math.min(.22,p.range):p.range)/e.scale;
      ctx.globalAlpha=Math.min(opacity*p.brightness*level*fade*(.5+.5*Math.min(1,pulse.energy*p.sensitivity)),s.safeFlash?.16/flashCount:1);
      if(reduced)ctx.globalAlpha*=.3;const g=ctx.createRadialGradient(0,0,0,0,0,radius);g.addColorStop(0,e.color);g.addColorStop(1,e.color+'00');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,radius,0,J.TAU);ctx.fill();
    }else if(e.type==='Geometry Motion'){
      for(let i=0;i<Math.min(32,count);i++){ctx.save();const phase=clock*(.4+rand(i)),distance=short*p.travel*Math.sin(phase+rand(i+40)*J.TAU);ctx.translate(Math.cos(angle)*distance,Math.sin(angle)*distance);ctx.rotate((clock*p.rotationSpeed+i*360/Math.min(32,count))*J.DEG);const size=short*p.size*3*(1+p.zoom*Math.sin(phase)*.3)*reaction;ctx.beginPath();
        if(p.shape==='circle')ctx.arc(0,0,size,0,J.TAU);else if(p.shape==='square')ctx.rect(-size,-size,size*2,size*2);else if(p.shape==='line'){ctx.moveTo(-size,0);ctx.lineTo(size,0);}else{ctx.moveTo(0,-size);ctx.lineTo(size,size);ctx.lineTo(-size,size);ctx.closePath();}ctx.stroke();ctx.restore();}
    }else if(e.type==='Audio Pulse'){
      const smooth=pulse.value/(1+p.fade),v=Math.min(1,p.sensitivity*(pulse.energy+smooth)*p.pulse),radius=short*p.range*(1+p.zoom*v);
      ctx.globalAlpha*=.25+.6*v;ctx.beginPath();ctx.arc(0,0,radius,0,J.TAU);ctx.stroke();ctx.beginPath();ctx.arc(0,0,radius*.72,0,J.TAU);ctx.stroke();
    }else if(e.type==='Light Trails'){
      for(let i=0;i<Math.min(40,count);i++){const phase=(clock*p.velocity+rand(i))%1,distance=(phase-.5)*short*2,len=p.length*short;ctx.save();ctx.translate(Math.cos(angle)*distance,Math.sin(angle)*distance+(rand(i+50)-.5)*short*.5);ctx.rotate(angle);ctx.globalAlpha=opacity*fade*Math.sin(phase*Math.PI)*(.25+.65*p.glow);ctx.lineWidth=short*p.lineWidth;ctx.beginPath();ctx.moveTo(-len,0);ctx.lineTo(0,0);ctx.stroke();ctx.restore();}
    }else{
      const progress=Math.min(1,u/Math.min(d,p.duration)),dist=short*p.range*(p.accent==='diffuse'?progress:1-progress);
      for(let i=0;i<Math.min(80,count);i++){const a=rand(i)*J.TAU;ctx.beginPath();if(p.accent==='gather')ctx.arc(Math.cos(a)*dist,Math.sin(a)*dist,short*p.size,0,J.TAU);else{ctx.moveTo(Math.cos(a)*dist,Math.sin(a)*dist);ctx.lineTo(Math.cos(a)*(dist+short*.025),Math.sin(a)*(dist+short*.025));}if(p.accent==='gather')ctx.fill();else ctx.stroke();}
    }ctx.restore();
  }
};
// Same composition point for normal preview and every flattened MP4 path.
J.composeInstrumentalStudio = (ctx,project,t,lyrics,assets,preview=false) => {
  const F=J.InstrumentalFX;if(!J.studioOn(project,'timeline')){F.draw(ctx,project,t,'back',preview);ctx.drawImage(lyrics,0,0);F.draw(ctx,project,t,'front',preview);return;}
  J.composeStudioLayers(ctx,project,t,lyrics,assets,{beforeLyrics:()=>F.draw(ctx,project,t,'back',preview),afterLyrics:()=>F.draw(ctx,project,t,'front',preview)});
};
const planner=J.plan;
J.plan=(project,audio)=>{const p=planner(project,audio),s=p.studio?.instrumentalFx;if(s?.enabled&&(s.auto||s.manual))p.duration=Math.max(p.duration,...(s.auto?s.regions:[]).map(r=>r.end),...(s.auto?s.autoEffects:[]).map(e=>e.end),...(s.manual?s.manualEffects:[]).map(e=>e.end));return p;};
})();
