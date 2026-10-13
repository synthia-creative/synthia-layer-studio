/* Instrumental FX v2 adapters: real PCM features, deterministic reactions and composition. */
(() => {
'use strict';
const F=J.InstrumentalFX,R=J.AudioReactive={version:2},clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),num=(v,d,a,b)=>Number.isFinite(v)?clamp(v,a,b):d;
R.audioTypes=['Audio Spectrum','Audio Waveform','Audio Reactive Transform'];
R.videoTypes=['RGB Glitch','Glow','Motion Blur','Radial Blur','Light Rays','Zoom Pulse','Mirror','Kaleidoscope','Film Grain'];
R.types=[...R.audioTypes,...R.videoTypes];F.types.push(...R.types);
R.settings=v=>({layout:['bars','mirror','circle','line'].includes(v?.layout)?v.layout:'bars',band:['all','low','mid','high'].includes(v?.band)?v.band:'all',bars:Math.round(num(v?.bars,48,8,64)),sensitivity:num(v?.sensitivity,1,0,4),bassGain:num(v?.bassGain,1,0,4),midGain:num(v?.midGain,1,0,4),trebleGain:num(v?.trebleGain,1,0,4),attackMs:num(v?.attackMs,20,5,500),releaseMs:num(v?.releaseMs,220,20,2000),smoothing:num(v?.smoothing,.25,0,.95),peakHoldMs:num(v?.peakHoldMs,100,0,2000),glow:num(v?.glow,.25,0,1),height:num(v?.height,.22,.01,.8),jitter:num(v?.jitter,0,0,.5),scaleAmount:num(v?.scaleAmount,.4,0,2),rotationAmount:num(v?.rotationAmount,12,-90,90),moveAmount:num(v?.moveAmount,.025,-.5,.5),opacityAmount:num(v?.opacityAmount,.25,0,1),trigger:['rms','peak','onset','beat','low','mid','high'].includes(v?.trigger)?v.trigger:'rms',targetId:typeof v?.targetId==='string'&&/^(?:fx|layer):[-\w]{1,100}$/.test(v.targetId)?v.targetId:''});
R.presets={
 Ballad:{color:'#a7c5df',layout:'bars',bars:24,releaseMs:480,glow:.12,height:.12,scaleAmount:.15,rotationAmount:2,moveAmount:.008,video:'Light Rays',trigger:'rms'},
 Rock:{color:'#ff8866',layout:'mirror',bars:48,releaseMs:140,glow:.3,height:.25,scaleAmount:.45,rotationAmount:18,moveAmount:.035,video:'RGB Glitch',trigger:'onset'},
 EDM:{color:'#65cfff',layout:'circle',bars:64,releaseMs:110,glow:.5,height:.3,scaleAmount:.65,rotationAmount:30,moveAmount:.04,video:'Zoom Pulse',trigger:'beat'},
 Pop:{color:'#ff7da9',layout:'bars',bars:40,releaseMs:200,glow:.25,height:.2,scaleAmount:.35,rotationAmount:10,moveAmount:.025,video:'Glow',trigger:'rms'},
 Cinematic:{color:'#e7cda3',layout:'mirror',bars:32,releaseMs:550,glow:.18,height:.13,scaleAmount:.2,rotationAmount:3,moveAmount:.01,video:'Light Rays',trigger:'low'},
 'Lo-Fi':{color:'#b9d3b0',layout:'line',bars:24,releaseMs:380,glow:.05,height:.14,scaleAmount:.12,rotationAmount:2,moveAmount:.005,video:'Film Grain',trigger:'rms'}
};
const stride=134,maxFrames=9000,byteCache=new WeakMap(),shapeCache=new WeakMap(),keyCache=new WeakMap();
R.audioKey=audio=>{const b=audio?.buffer;if(!b)return '';let key=keyCache.get(b);if(key)return key;let h=2166136261,g=2246822507;for(let c=0;c<b.numberOfChannels;c++){const samples=b.getChannelData(c);for(let i=0;i<4096;i++){const index=Math.floor(F.random(7919+c,i)*samples.length),value=Math.round((samples[index]||0)*1e6);h=Math.imul(h^value,16777619);g=Math.imul(g^value,3266489909);}}key='ar2-'+F.hash([b.length,b.sampleRate,b.numberOfChannels,h>>>0,g>>>0]);keyCache.set(b,key);return key;};
R.pack=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
R.featureData=v=>{
 if(!v||v.version!==1||typeof v.key!=='string'||!Number.isFinite(v.duration)||v.duration<=0||v.duration>86400||!Number.isFinite(v.rate)||v.rate<=0||v.rate>30||!Number.isInteger(v.frames)||v.frames<1||v.frames>maxFrames||v.stride!==stride||typeof v.packed!=='string'||v.packed.length!==4*Math.ceil(v.frames*stride/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(v.packed))return null;
 if(Math.abs(v.frames-Math.ceil(v.duration*v.rate))>1)return null;
 return {version:1,key:v.key.slice(0,100),duration:num(v.duration,1,.01,86400),rate:v.rate,frames:v.frames,stride,packed:v.packed,frequencies:Array.isArray(v.frequencies)&&v.frequencies.length===64?v.frequencies.map(x=>num(x,0,0,192000)):Array.from({length:64},(_,i)=>80*Math.pow(150,i/63)),beats:(Array.isArray(v.beats)?v.beats:[]).slice(0,100000).filter(t=>Number.isFinite(t)&&t>=0&&t<v.duration).sort((a,b)=>a-b)};
};
R.unpack=features=>{let bytes=byteCache.get(features);if(bytes)return bytes;try{const s=atob(features.packed);if(s.length!==features.frames*stride)return null;bytes=Uint8Array.from(s,c=>c.charCodeAt(0));byteCache.set(features,bytes);return bytes;}catch{return null;}};
R.state=v=>({preset:Object.hasOwn(R.presets,v?.preset)?v.preset:'Pop',spectrum:v?.spectrum!==false,waveform:v?.waveform===true,video:v?.video!==false,settings:R.settings(v?.settings),features:R.featureData(v?.features),beforeFeatures:R.featureData(v?.beforeFeatures),beforeFeatureKey:String(v?.beforeFeatureKey||'').slice(0,100)});
const effect=F.effect,normalize=F.normalize;
F.effect=(v={},source='manual')=>{const e=effect(v,source);if(R.types.includes(e.type)){e.reactive=R.settings(v.reactive);if(e.type==='Audio Spectrum'&&e.reactive.layout==='line')e.reactive.layout='bars';if(e.type==='Audio Waveform'&&e.reactive.layout!=='circle')e.reactive.layout='line';}return e;};
F.normalize=v=>({...normalize(v),reactive:R.state(v?.reactive)});
const sample=(array,t,rate)=>{const i=Math.max(0,Math.min(array.length-1,Math.round(t*rate)));return array[i]||0;};
R.buildFeatures=async(audio,fft,signal)=>{
 const a=J.studioAnalyze(audio),buffer=audio.buffer,rate=Math.min(30,maxFrames/audio.duration),frames=Math.min(maxFrames,Math.ceil(audio.duration*rate)),bytes=new Uint8Array(frames*stride),channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
 const rmsSamples=Array.from(a.rms).filter((_,i)=>i%Math.max(1,Math.ceil(a.rms.length/20000))===0).sort((x,y)=>x-y),rmsReference=Math.max(.0001,rmsSamples[Math.floor(rmsSamples.length*.95)]||0);
 const beats=[];for(const beat of a.beats){let best=0,time=beat;for(let i=Math.max(0,Math.floor((beat-.12)*a.rate));i<Math.min(a.onset.length,Math.ceil((beat+.12)*a.rate));i++)if(a.onset[i]>best){best=a.onset[i];time=i/a.rate;}if(best>.08&&sample(a.rms,time,a.rate)>.0001&&(!beats.length||time-beats.at(-1)>=.08))beats.push(time);}
 for(let f=0;f<frames;f++){
  if(f%128===0){if(signal?.aborted)throw new DOMException('Cancelled','AbortError');await new Promise(ok=>setTimeout(ok,0));}
  const t=f/rate,ff=Math.min(fft.frames-1,Math.round(t*fft.rate)),offset=f*stride;
  for(let b=0;b<64;b++)bytes[offset+b]=Math.round(clamp((fft.raw[ff*64+b]+78)/64,0,1)*255);
  const center=Math.round(t*buffer.sampleRate),window=Math.round(buffer.sampleRate*.025);
  for(let p=0;p<64;p++){const i=center+Math.round((p/63-.5)*window);let value=0;for(const c of channels)value+=(c[i]||0)/channels.length;bytes[offset+64+p]=Math.round(clamp(value,-1,1)*127+128);}
  for(let band=0;band<3;band++)bytes[offset+128+band]=Math.round(clamp((fft.reactiveBands?.[ff*3+band]||0)/rmsReference,0,1)*255);
  bytes[offset+131]=Math.round(clamp(sample(a.rms,t,a.rate)/rmsReference,0,1)*255);
  bytes[offset+132]=Math.round(clamp(sample(a.peak,t,a.rate),0,1)*255);
  bytes[offset+133]=Math.round(clamp(sample(a.onset,t,a.rate)/2,0,1)*255);
 }
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 return R.featureData({version:1,key:R.audioKey(audio),duration:audio.duration,rate,frames,stride,packed:R.pack(bytes),frequencies:Array.from({length:64},(_,i)=>(fft.bandEdges[i]+fft.bandEdges[i+1])/2*buffer.sampleRate/fft.fftSize),beats});
};
R.prepare=async(audio,previous,signal)=>{if(!audio?.buffer)throw new Error(J.layerText('音源を読み込んでください。音楽連動には実際の音声解析が必要です。','Load audio. Audio reactions require real audio analysis.'));if(previous?.key===R.audioKey(audio))return previous;return R.buildFeatures(audio,await J.sharedAudioFFT(audio.buffer,signal),signal);};
R.shape=(features,settings)=>{
 const c=R.settings(settings),key=JSON.stringify([c.attackMs,c.releaseMs,c.smoothing,c.peakHoldMs,c.sensitivity,c.bassGain,c.midGain,c.trebleGain]),bytes=R.unpack(features);if(!bytes)return null;
 let cache=shapeCache.get(features);if(!cache){cache=new Map();shapeCache.set(features,cache);}if(cache.has(key))return cache.get(key);
 const columns=70,values=new Float32Array(features.frames*columns),current=new Float32Array(columns),hold=new Float32Array(columns),attack=1-Math.exp(-1000/(features.rate*c.attackMs)),release=1-Math.exp(-1000/(features.rate*c.releaseMs));
 for(let f=0;f<features.frames;f++)for(let k=0;k<columns;k++){
  const index=k<64?k:128+k-64,hz=features.frequencies[k],gain=k<64?(hz<250?c.bassGain:hz<4000?c.midGain:c.trebleGain):k===64?c.bassGain:k===65?c.midGain:k===66?c.trebleGain:1,target=clamp(bytes[f*stride+index]/255*c.sensitivity*gain,0,1);
  if(target>=current[k]){current[k]+=(target-current[k])*attack*(1-c.smoothing*.8);hold[k]=Math.ceil(c.peakHoldMs*features.rate/1000);}
  else if(hold[k]>0)hold[k]--;else current[k]+=(target-current[k])*release*(1-c.smoothing*.8);
  if(current[k]<.001)current[k]=0;values[f*columns+k]=current[k];
 }
 const shaped={values,columns};if(cache.size>=4)cache.delete(cache.keys().next().value);cache.set(key,shaped);return shaped;
};
R.frame=(features,t,settings={})=>{
 const spectrum=new Float32Array(64),wave=new Float32Array(64),out={spectrum,wave,low:0,mid:0,high:0,rms:0,peak:0,onset:0,beat:0};if(!features||t<0||t>=features.duration)return out;
 const data=R.shape(features,settings),bytes=R.unpack(features);if(!data||!bytes)return out;
 const pos=t*features.rate,a=Math.min(features.frames-1,Math.floor(pos)),b=Math.min(features.frames-1,a+1),mix=pos-Math.floor(pos),value=k=>data.values[a*70+k]*(1-mix)+data.values[b*70+k]*mix;
 for(let k=0;k<64;k++){spectrum[k]=value(k);wave[k]=((bytes[a*stride+64+k]-128)*(1-mix)+(bytes[b*stride+64+k]-128)*mix)/127;}
 ['low','mid','high','rms','peak','onset'].forEach((k,i)=>out[k]=value(64+i));
 const beat=F.lastBeat(features.beats,t),last=beat>=0?features.beats[beat]:-Infinity;out.beat=Math.exp(-Math.max(0,t-last)/.16)*Math.min(1,out.rms*2);return out;
};
R.featuresFor=project=>{const features=project.studio?.instrumentalFx?.reactive?.features;if(project===J.ui?.project&&J.ui.audio?.buffer&&features?.key!==R.audioKey(J.ui.audio))return null;return features;};
R.allowed=(s,e)=>e.type==='Audio Spectrum'?s.reactive?.spectrum!==false:e.type==='Audio Waveform'?s.reactive?.waveform!==false:R.videoTypes.includes(e.type)?s.reactive?.video!==false:true;
R.visible=(s,t,preview)=>[...F.active(s,t,'back',preview),...F.active(s,t,'front',preview)].filter(e=>R.allowed(s,e));
R.response=(s,e,t,features)=>{const c=R.settings(e.reactive),frame=R.frame(features,t,c);if(!e.beat||e.source==='auto'&&!s.beat)frame.beat=0;const amount=frame[c.trigger]*e.intensity,beat=frame.beat*e.intensity,motion=(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true)? .25:1;return {frame,amount,scale:1+c.scaleAmount*amount*motion,rotation:c.rotationAmount*beat*motion,x:c.moveAmount*beat*motion,y:-c.moveAmount*beat*motion,opacity:1-c.opacityAmount*(1-amount),glow:c.glow*amount};};
R.targetEffect=(s,e,t,preview=false)=>{const features=s.reactive?.features,controller=R.visible(s,t,preview).find(c=>c.type==='Audio Reactive Transform'&&c.reactive.targetId==='fx:'+e.id);if(!features||!controller)return e;const r=R.response(s,controller,t,features),next={...e,x:clamp(e.x+r.x+controller.x-.5,-2,3),y:clamp(e.y+r.y+controller.y-.5,-2,3),scale:clamp(e.scale*r.scale*controller.scale,.05,10),rotation:e.rotation+r.rotation+controller.rotation,opacity:e.opacity*r.opacity};if(R.audioTypes.includes(e.type))next.reactive={...e.reactive,glow:Math.min(1,e.reactive.glow+r.glow)};else{next.reactionGlow=r.glow;next.reactionColor=controller.color;}return next;};
R.generate=(state,regions)=>{
 const s=state.reactive,preset=R.presets[s.preset],out=[],strength=state.strength/100;if(!strength)return out;
 for(const region of regions.filter(r=>r.auto)){
  const types=[];if(s.spectrum)types.push('Audio Spectrum');if(s.waveform)types.push('Audio Waveform');if(types.length===1)types.push('Audio Reactive Transform');if(s.video)types.push(preset.video);
  for(const type of types.slice(0,3)){const e=F.effect({id:'reactive-'+F.hash([state.seed,region.id,type]),type,start:region.start,end:region.end,regionId:region.id,seed:F.hash([state.seed,region.id,type]),color:preset.color,intensity:strength,opacity:.85,plane:type==='Audio Spectrum'||type==='Audio Waveform'?'front':'back',x:.5,y:type==='Audio Spectrum'&&preset.layout!=='circle'?.8:.5,params:{count:1,range:.22,lineWidth:.004,shape:s.preset==='Rock'?'triangle':'circle'},reactive:{...s.settings,...preset,layout:type==='Audio Waveform'?'line':preset.layout}},'auto');if(!out.some(x=>x.id===e.id))out.push(e);}
  if(out.length>512)throw new Error(J.layerText('自動FXは512件までです。対象区間を減らしてください。','Auto FX limit: 512. Reduce target sections.'));
 }
 return out;
};
function drawAudio(ctx,project,e,t){
 const features=R.featuresFor(project);if(!features)return;const s=project.studio.instrumentalFx,c=R.settings(e.reactive),response=R.response(s,e,t,features),a=response.frame,w=ctx.canvas.width,h=ctx.canvas.height,short=Math.min(w,h),fade=Math.min(1,(t-e.start)/.2,(e.end-t)/.2),reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
 if(e.type==='Audio Reactive Transform'&&c.targetId)return;
 ctx.save();ctx.translate(e.x*w,e.y*h);ctx.rotate((e.rotation+(e.type==='Audio Reactive Transform'?response.rotation:0))*J.DEG);ctx.scale(e.scale,e.scale);ctx.globalCompositeOperation=e.blend;ctx.globalAlpha=e.opacity*fade*e.intensity;ctx.fillStyle=ctx.strokeStyle=e.color;ctx.lineWidth=short*e.params.lineWidth;ctx.shadowColor=e.color;ctx.shadowBlur=Math.min(24,short*c.glow*.05*a.rms);ctx.lineJoin='round';ctx.lineCap='round';
 if(e.type==='Audio Spectrum'){
  const indices=Array.from({length:64},(_,i)=>i).filter(i=>c.band==='all'||c.band==='low'&&features.frequencies[i]<250||c.band==='mid'&&features.frequencies[i]>=250&&features.frequencies[i]<4000||c.band==='high'&&features.frequencies[i]>=4000),count=Math.min(c.bars,s.quality==='low'?24:64),width=short*.9,cell=width/count,level=i=>(a.spectrum[indices[Math.min(indices.length-1,Math.floor(i/count*indices.length))]]||0)*c.height*short;
  for(let i=0;i<count;i++){const v=level(i);if(v<.1)continue;if(c.layout==='circle'){const angle=i/count*J.TAU,radius=short*e.params.range;ctx.save();ctx.rotate(angle);ctx.fillRect(radius,-cell*.22,v,cell*.44);ctx.restore();}else ctx.fillRect(-width/2+cell*(i+.15),c.layout==='mirror'?-v/2:-v,cell*.7,c.layout==='mirror'?v:v);}
 }else if(e.type==='Audio Waveform'){
  if(a.rms>0){const points=[];for(let i=0;i<64;i++){const jitter=reduced?0:c.jitter*a.onset*(F.random(e.seed,Math.floor(t*features.rate)+i)-.5)*short,value=a.wave[i]*c.height*short+jitter;if(c.layout==='circle'){const angle=i/63*J.TAU,radius=short*e.params.range+value;points.push([Math.cos(angle)*radius,Math.sin(angle)*radius]);}else points.push([(i/63-.5)*short*.95,value]);}ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++){const previous=points[i-1],next=points[i];ctx.quadraticCurveTo(...previous,(previous[0]+next[0])/2,(previous[1]+next[1])/2);}ctx.lineTo(...points.at(-1));if(c.layout==='circle')ctx.closePath();ctx.stroke();}
 }else{
  const size=short*e.params.range*response.scale;ctx.globalAlpha*=response.opacity;ctx.translate(response.x*w,response.y*h);ctx.beginPath();if(e.params.shape==='square')ctx.rect(-size,-size,size*2,size*2);else if(e.params.shape==='triangle'){ctx.moveTo(0,-size);ctx.lineTo(size,size);ctx.lineTo(-size,size);ctx.closePath();}else if(e.params.shape==='line'){ctx.moveTo(-size,0);ctx.lineTo(size,0);}else ctx.arc(0,0,size,0,J.TAU);ctx.stroke();
 }ctx.restore();
}
const legacyDraw=F.draw;
F.draw=(ctx,project,t,plane='back',preview=false)=>{
 const s=project.studio?.instrumentalFx;if(!s)return;const active=R.visible(s,t,preview),features=R.featuresFor(project),react=e=>features?R.targetEffect(s,e,t,preview):e;
 let effective=s;
 if(active.some(e=>R.types.includes(e.type))){effective={...s};const ids=new Set(active.map(e=>e.id));for(const key of ['autoEffects','manualEffects'])effective[key]=s[key].filter(e=>ids.has(e.id)&&!R.types.includes(e.type)).map(react);}
 legacyDraw(ctx,effective===s?project:{...project,studio:{...project.studio,instrumentalFx:effective}},t,plane,preview);
 for(const e of [...effective.autoEffects,...effective.manualEffects].filter(e=>e.plane===plane&&e.reactionGlow>0&&e.type!=='Light Flash'&&!(e.type==='Transition Accent'&&e.params.accent==='flash'))){ctx.save();ctx.shadowColor=e.reactionColor;ctx.shadowBlur=Math.min(20,Math.min(ctx.canvas.width,ctx.canvas.height)*e.reactionGlow*.04);const glow={...e,opacity:e.opacity*e.reactionGlow*.2},gs={...effective,autoEffects:e.source==='auto'?[glow]:[],manualEffects:e.source==='manual'?[glow]:[]};legacyDraw(ctx,{...project,studio:{...project.studio,instrumentalFx:gs}},t,plane,preview);ctx.restore();}
 if(plane!=='front'||!J.studioOn(project,'timeline'))for(const e of active.filter(e=>e.plane===plane&&R.audioTypes.includes(e.type)))drawAudio(ctx,project,react(e),t);
};
let compositionPreview=false;
J.instrumentalLayerResponse=(project,layer,t)=>{
 const s=project.studio?.instrumentalFx,features=R.featuresFor(project);if(layer.type==='Lyrics'||!s||!features)return null;const effect=R.visible(s,t,compositionPreview).find(e=>e.type==='Audio Reactive Transform'&&e.reactive.targetId==='layer:'+layer.id);if(!effect)return null;
 const r=R.response(s,effect,t,features),p=layer.transform,design=J.designSize(project.aspect);return {transform:{...p,x:p.x+(r.x+effect.x-.5)*design[0],y:p.y+(r.y+effect.y-.5)*design[1],scale:clamp(p.scale*r.scale*effect.scale,.05,10),rotation:p.rotation+r.rotation+effect.rotation,opacity:p.opacity*r.opacity},glow:r.glow,color:effect.color};
};
// Reused scratch buffers; the renderer never uses a previous frame as history.
const scratch=new WeakMap();
R.post=(ctx,project,t,preview=false)=>{
 const s=project.studio?.instrumentalFx;if(!s)return;const features=R.featuresFor(project);if(!features)return;const effects=R.visible(s,t,preview).filter(e=>R.videoTypes.includes(e.type)).slice(0,2);if(!effects.length)return;
 const target=ctx,fullWidth=ctx.canvas.width,fullHeight=ctx.canvas.height,limit=s.quality==='low'?480:s.quality==='high'?1280:960,ratio=Math.min(1,limit/Math.max(fullWidth,fullHeight)),sw=Math.max(1,Math.round(fullWidth*ratio)),sh=Math.max(1,Math.round(fullHeight*ratio)),w=sw,h=sh;let buffers=scratch.get(target.canvas);if(!buffers){buffers={source:J.layerCanvas(sw,sh),output:J.layerCanvas(sw,sh)};scratch.set(target.canvas,buffers);}for(const canvas of Object.values(buffers))if(canvas.width!==sw||canvas.height!==sh){canvas.width=sw;canvas.height=sh;}const cv=buffers.source,x=cv.getContext('2d');ctx=buffers.output.getContext('2d');const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
 for(const e of effects){const response=R.response(s,e,t,features),amount=Math.min(s.safeFlash?.45:1,response.amount)*(reduced?.3:1)*Math.min(1,(t-e.start)/.2,(e.end-t)/.2);if(amount<.001)continue;x.clearRect(0,0,sw,sh);x.drawImage(target.canvas,0,0,sw,sh);ctx.clearRect(0,0,sw,sh);ctx.save();ctx.globalAlpha=amount;
  if(e.type==='Zoom Pulse'){const zoom=1+amount*.12;ctx.globalAlpha=1;ctx.drawImage(cv,-w*(zoom-1)/2,-h*(zoom-1)/2,w*zoom,h*zoom);}
  else if(e.type==='Mirror'){for(let i=0;i<2;i++){ctx.save();ctx.beginPath();ctx.rect(i*w/2,0,w/2,h);ctx.clip();ctx.translate(i?w:0,0);ctx.scale(i?-1:1,1);ctx.drawImage(cv,0,0,w,h);ctx.restore();}}
  else if(e.type==='Kaleidoscope'){const parts=s.quality==='low'?4:s.quality==='high'?8:6,radius=Math.hypot(w,h);ctx.translate(w/2,h/2);for(let i=0;i<parts;i++){const start=i/parts*J.TAU,end=(i+1)/parts*J.TAU;ctx.save();ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,radius,start,end);ctx.closePath();ctx.clip();ctx.rotate(start);if(i%2)ctx.scale(1,-1);ctx.drawImage(cv,-w/2,-h/2,w,h);ctx.restore();}}
  else if(e.type==='RGB Glitch'){const pixels=x.getImageData(0,0,sw,sh),src=new Uint8ClampedArray(pixels.data),shift=Math.max(1,Math.round(amount*sw*.018));for(let y=0;y<sh;y++){const offset=Math.round((F.random(e.seed,Math.floor(t*30)+y%12)-.5)*shift);for(let col=0;col<sw;col++){const i=(y*sw+col)*4;pixels.data[i]=src[(y*sw+clamp(col+shift+offset,0,sw-1))*4];pixels.data[i+2]=src[(y*sw+clamp(col-shift+offset,0,sw-1))*4+2];}}x.putImageData(pixels,0,0);ctx.drawImage(cv,0,0,w,h);}
  else if(e.type==='Film Grain'){const count=s.quality==='low'?100:350;ctx.globalAlpha=amount*.14;for(let i=0;i<count;i++){const random=F.random(e.seed,Math.floor(t*30)*count+i);ctx.fillStyle=random>.5?'#fff':'#000';ctx.fillRect(random*w,F.random(e.seed,i+Math.floor(t*30)*count+123)*h,2,2);}}
  else if(e.type==='Glow'){ctx.globalCompositeOperation='screen';ctx.globalAlpha=amount*.35;ctx.filter='blur('+Math.min(12,amount*12)+'px)';ctx.drawImage(cv,0,0,w,h);}
  else {const count=s.quality==='low'?3:s.quality==='high'?8:5;ctx.globalAlpha=amount/(count+1)*(e.type==='Light Rays'?.4:1);if(e.type==='Light Rays')ctx.globalCompositeOperation='screen';for(let i=1;i<=count;i++){if(e.type==='Motion Blur')ctx.drawImage(cv,amount*i*2,amount*i,w,h);else{const z=1+amount*i*.015;ctx.drawImage(cv,-w*(z-1)/2,-h*(z-1)/2,w*z,h*z);}}}
  ctx.restore();target.save();target.globalCompositeOperation=e.type==='Glow'||e.type==='Light Rays'?'screen':'source-over';target.drawImage(buffers.output,0,0,fullWidth,fullHeight);target.restore();
 }
};
const compose=J.composeInstrumentalStudio;
J.composeInstrumentalStudio=(ctx,project,t,lyrics,assets,preview=false)=>{const previous=compositionPreview;compositionPreview=preview;try{compose(ctx,project,t,lyrics,assets,preview);if(J.studioOn(project,'timeline'))for(const e of R.visible(project.studio.instrumentalFx,t,preview).filter(e=>e.plane==='front'&&R.audioTypes.includes(e.type)))drawAudio(ctx,project,R.featuresFor(project)?R.targetEffect(project.studio.instrumentalFx,e,t,preview):e,t);R.post(ctx,project,t,preview);}finally{compositionPreview=previous;}};
const exportVideo=J.exportSimpleVideo;
J.exportSimpleVideo=async options=>{const s=options.project.studio?.instrumentalFx;if(s?.enabled&&[...(s.auto?s.autoEffects:[]),...(s.manual?s.manualEffects:[])].some(e=>e.visible&&R.types.includes(e.type))){if(!s.reactive?.features||options.audio?.buffer&&R.audioKey(options.audio)!==s.reactive.features.key)throw new Error(J.layerText('音源を読み込み、自動作成で音楽連動の解析を更新してください。','Load audio and use automatic creation to refresh the audio reactions.'));}return exportVideo(options);};
const planProject=J.plan;
J.plan=(project,audio)=>{const plan=planProject(project,audio),s=plan.studio?.instrumentalFx;if(s?.enabled&&s.reactive?.features&&[...(s.auto?s.autoEffects:[]),...(s.manual?s.manualEffects:[])].some(e=>R.types.includes(e.type)))plan.duration=Math.max(plan.duration,s.reactive.features.duration);return plan;};
})();
