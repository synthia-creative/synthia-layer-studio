const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={window:{},console,structuredClone,DOMException,setTimeout,document:{documentElement:{lang:'ja'},createElement:()=>({getContext:()=>({measureText:t=>({width:String(t).length*20})})})}};vm.createContext(sandbox);
for(const file of fs.readdirSync(path.join(__dirname,'../src')).filter(n=>n.endsWith('.js')&&n<'12').sort())vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),sandbox);
const J=sandbox.window.J,F=J.InstrumentalFX,E=J.InstrumentalEasy,json=v=>JSON.parse(JSON.stringify(v));
const cues=[{id:'one',start:3,end:7,text:'ONE'},{id:'two',start:22,end:26,text:'TWO'}],audio={buffer:{},duration:30};
test('one-click detects all sections without mutating source, and defaults generate via v1 engine',async()=>{
 const p=J.defaultProject(),s=p.studio.instrumentalFx,before=json(s),prepared=E.prepare(s,cues,audio);
 assert.deepEqual(json(prepared.regions.map(r=>r.type)),['Intro','Interlude','Outro']);assert.deepEqual(json(s),before);
 const effects=await F.generate(s,prepared.regions,null,p,null);assert(effects.length>0);assert.equal(s.enabled,false);assert.equal(s.auto,false);assert.equal(s.manual,false);
 assert.equal(prepared.detectionKey,F.detectionKey(cues,30,s.minGap,s.boundary));
});
test('all saved section boundaries and generation exclusions survive one-click preparation',()=>{
 const s=F.normalize({regions:[{id:'manual',start:8,end:20,type:'Custom',edited:true},{id:'excluded',start:0,end:3,type:'Intro',auto:false}]}),before=json(s),r=E.prepare(s,cues,audio).regions;
 assert.deepEqual(json(r.find(r=>r.id==='manual')),before.regions[0]);assert.deepEqual(json(r.find(r=>r.id==='excluded')),before.regions[1]);assert(!r.some(r=>r.id!=='manual'&&r.start<20&&r.end>8));assert.deepEqual(json(s),before);
});
test('missing SRT/audio and absent target fail before modifying state',()=>{
 const s=F.normalize(),before=json(s);assert.throws(()=>E.prepare(s,undefined,audio),/SRT/);assert.throws(()=>E.prepare(s,[],audio),/SRT/);assert.throws(()=>E.prepare(s,cues,null),/音源/);
 assert.throws(()=>E.prepare(s,[{start:0,end:30,text:'continuous'}],audio),/区間/);assert.deepEqual(json(s),before);
});
test('manual addition uses exact playhead and three-second preset regardless of selected region',()=>{
 const s=F.normalize({regions:[{id:'r',start:7,end:22}],seed:42}),before=json(s),a=E.manual(s,'Geometry Motion',10,30),b=E.manual(s,'Audio Pulse',5,30);
 assert.equal(a.effect.start,10);assert.equal(a.effect.end,13);assert.equal(a.effect.regionId,'r');assert.equal(a.outside,false);assert.equal(a.effect.seed,42);assert.equal(a.effect.x,.5);
 assert.equal(b.effect.start,5);assert.equal(b.effect.end,8);assert.equal(b.outside,true);assert.deepEqual(json(s),before);
});
test('manual addition clamps at song end and rejects positions without any remaining duration',()=>{
 const s=F.normalize();assert.equal(E.manual(s,'Particle Burst',29,30).effect.end,30);for(const t of [30,31,-1,NaN,Infinity])assert.throws(()=>E.manual(s,'Particle Burst',t,30));assert.throws(()=>E.manual(s,'Particle Burst',0,0));
});
test('simple choices map directly to supported v1 values; every choice remains deterministic',async()=>{
 const p=J.defaultProject(),regions=E.prepare(p.studio.instrumentalFx,cues,audio).regions;
 for(const style of E.styles)for(const strength of E.strengths){const s=F.normalize({style,strength});assert(F.styles.includes(style));assert.equal(s.style,style);assert.equal(s.strength,strength);assert.deepEqual(json(await F.generate(s,regions,null,p,null)),json(await F.generate(s,regions,null,p,null)));}
});
test('preview seeks to an existing illuminated flash phase without changing FX or analysis',()=>{
 const s=F.normalize({analysis:{key:'test',duration:16,rate:1,beats:Array.from({length:32},(_,i)=>i*.5),bpm:120}}),e=F.effect({type:'Light Flash',start:5.1,end:10.1}),before=json(e),t=E.reviewTime(s,e),event=F.flashEvent(s,e,t);
 assert(t>=e.start&&t<e.end);assert(event>=e.start&&t-event>0&&t-event<e.params.duration);assert.deepEqual(json(e),before);
 assert.equal(E.reviewTime(s,F.effect({type:'Geometry Motion',start:1,end:4})),1.5);
 assert.equal(E.reviewTime(s,F.effect({...e,end:5.11})),null);
});
