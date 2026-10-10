const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={window:{},document:{documentElement:{lang:'ja'},createElement:()=>({getContext:()=>({measureText:t=>({width:String(t).length*20})})})},console,structuredClone,crypto:require('node:crypto').webcrypto};
vm.createContext(sandbox);for(const n of fs.readdirSync(path.join(__dirname,'../src')).filter(n=>n.endsWith('.js')&&n<'12').sort())vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',n),'utf8'),sandbox);
const J=sandbox.window.J,copy=x=>JSON.parse(JSON.stringify(x));
const fixture=(cuts=1)=>{const p=J.defaultProject();p.seed=2;p.subtitleCues=[{id:'one',text:'夜明けの色を/覚えてる',start:0,end:4},{id:'two',text:'別の行',start:4,end:8}];p.lyrics=p.subtitleCues.map(c=>c.text).join('\n');p.overrides[0]={cuts,layout:'tape',enter:'fade',exit:'fade',hold:'still',cam:'none',decor:['brackets','stripes'],treat:'none'};p.overrides[1]={...p.overrides[0]};return p;};
const target=(p,slot,line=0)=>J.plan(p).effectTargets.find(t=>t.slot===slot&&t.line===line);
test('old projects default to empty deletion state and malicious records are rejected',()=>{
 assert.deepEqual(copy(J.normalizeStudio().deletedObjects),{});
 const p=J.normalizeDeletedObjects({'__proto__':{},'deleted-a':{kind:'cut',owner:'cue-one',text:'a',signature:'s'},'deleted-b':{kind:'glyph',owner:'cue-one',text:'a',indices:[0,0,-1,NaN,'1',20000]},'deleted-c':{kind:'part',owner:'line-0',text:'a',signature:'s'},'deleted-d':{kind:'glyph',owner:'cue-one',text:'a',indices:[]}});
 assert.deepEqual(Object.keys(p),['deleted-a','deleted-b']);assert.deepEqual(copy(p['deleted-b'].indices),[0]);
});
test('grapheme deletion is atomic for combining marks, ZWJ, modifiers, flags and keycaps',()=>{
 for(const text of ['e\u0301','👨‍👩‍👧‍👦','👍🏽','🇯🇵','1️⃣']){const chars=[...text],expected=chars.map((_,i)=>i);for(let i=0;i<chars.length;i++)assert.deepEqual(copy(J.deletionGlyphIndices(text+'X',[i])),expected);}
 assert.deepEqual(copy(J.deletionGlyphIndices('A\nB',[1])),[1]);assert.deepEqual(copy(J.deletionGlyphIndices('A',[99])),[]);
});
test('glyph, effects-only, line and group deletion preserve source, timing, transforms and other cue',()=>{
 for(const kind of ['glyph','glyph-effect','line','group']){
  const p=fixture();p.studio.characters['cue-one']={line:J.studioTransform({rotation:25}),glyphs:{0:J.studioTransform({x:20,scale:2,opacity:.3})}};const before=copy(p),plan=J.plan(p),other=copy(J.lineSnapshot(plan,1));
  assert(J.deleteSelectedObject(p,{kind,line:0,index:0},plan));assert.deepEqual(copy(p.subtitleCues),before.subtitleCues);assert.equal(p.lyrics,before.lyrics);assert.deepEqual(copy(p.timing),before.timing);assert.deepEqual(copy(p.studio.characters),before.studio.characters);assert.deepEqual(copy(J.lineSnapshot(J.plan(p),1)),other);
  const records=Object.values(J.plan(p).studio.deletedObjects);assert.equal(records.length,1);assert.equal(records[0].kind,kind);
 }
});
test('deleting one tape leaves sibling and other cut and cue independently renderable',()=>{
 const p=fixture(2),plan=J.plan(p),parts=plan.effectTargets.filter(t=>t.kind==='part'&&!t.decoration&&!t.treatment&&t.line===0),t=parts[0];assert(t);assert(J.deleteSelectedObject(p,t,plan));const next=J.plan(p);assert(J.effectTargetDeleted(next,next.effectTargets.find(x=>x.signature===t.signature)));assert(next.effectTargets.filter(x=>x.signature!==t.signature&&x.kind==='part').every(x=>!J.effectTargetDeleted(next,x)));
});
test('cut deletion applies only to its own parts and never a temporal or companion sibling',()=>{
 const p=fixture(2),plan=J.plan(p),cuts=plan.effectTargets.filter(t=>t.kind==='cut'&&t.line===0);assert.equal(cuts.length,2);assert(J.deleteSelectedObject(p,cuts[0],plan));const next=J.plan(p);assert(next.effectTargets.filter(t=>t.cutSignature===cuts[0].signature||t.signature===cuts[0].signature).every(t=>J.effectTargetDeleted(next,t)));assert(next.effectTargets.filter(t=>t.signature===cuts[1].signature||t.cutSignature===cuts[1].signature).every(t=>!J.effectTargetDeleted(next,t)));
});
test('decorations have independent cut ownership and preserve existing part signatures',()=>{
 const p=fixture(2),plan=J.plan(p),a=plan.effectTargets.find(t=>t.decoration&&t.line===0),b=plan.effectTargets.find(t=>t.decoration&&t.line===0&&t.cutNumber!==a.cutNumber);assert(a&&b);assert(J.deleteSelectedObject(p,a,plan));const next=J.plan(p);assert(J.effectTargetDeleted(next,next.effectTargets.find(t=>t.signature===a.signature)));assert(!J.effectTargetDeleted(next,next.effectTargets.find(t=>t.signature===b.signature)));assert.equal(p.overrides[0].decor.length,2);
});
test('decoration transforms use stable IDs and coexist with display deletion',()=>{
 const p=fixture(),t=J.plan(p).effectTargets.find(t=>t.decoration),id=J.setEffectTransform(p,t,{x:.2,rotation:45});assert(id);let next=J.plan(p);assert.equal(next.effectTargets.find(t=>t.id===id).transform.rotation,45);assert(J.deleteSelectedObject(p,next.effectTargets.find(t=>t.id===id),next));assert.equal(p.studio.partTransforms[id].transform.rotation,45);
});
test('JSON reload and color/font/timing replan retain deletion with editor flag off',()=>{
 const p=fixture(),t=target(p,'tape-row-0');J.deleteSelectedObject(p,t);const saved=copy(p),q=J.defaultProject();J.upgradeLayerProject(q,saved);Object.assign(q,saved,{studio:J.normalizeStudio(saved.studio)});q.studio.flags.characterEditing=false;q.subtitleCues[0].start=.1;q.overrides[0].fonts={main:'serif'};const plan=J.plan(q);assert(J.effectTargetDeleted(plan,plan.effectTargets.find(x=>x.signature===t.signature)));assert.equal(Object.keys(plan.studio.deletedObjects).length,1);
});
test('changed topology suspends unmatched deletion instead of retargeting another object',()=>{
 const p=fixture(),t=target(p,'tape-row-0');J.deleteSelectedObject(p,t);p.overrides[0].cuts=2;assert(!J.plan(p).effectTargets.some(t=>J.effectTargetDeleted(J.plan(p),t)));p.overrides[0].cuts=1;assert(J.effectTargetDeleted(J.plan(p),target(p,'tape-row-0')));p.subtitleCues[0].text='changed';assert(!J.plan(p).effectTargets.some(t=>J.effectTargetDeleted(J.plan(p),t)));
});
test('stale, locked and absent selections are rejected without mutation',()=>{
 const p=fixture(),t=target(p,'tape-row-0');p.overrides[0].cuts=2;let before=JSON.stringify(p);assert(!J.deleteSelectedObject(p,t));assert.equal(JSON.stringify(p),before);p.subtitleCues[0].locked=true;before=JSON.stringify(p);assert(!J.deleteSelectedObject(p,{kind:'line',line:0}));assert(!J.deleteSelectedObject(p,null));assert.equal(JSON.stringify(p),before);
});
test('native lyric conversion, duplicate and cue deletion retain independent deletion ownership',()=>{
 const p=fixture();delete p.subtitleCues;p.lyrics='同じ行\n同じ行';p.timing.lineTimes={0:0,1:4};J.ui={audio:null};assert(J.deleteSelectedObject(p,{kind:'glyph',line:1,index:0}));let plan=J.plan(p);assert.equal(J.deletionRecords(plan,plan.lines[0]).length,0);assert.equal(J.deletionRecords(plan,plan.lines[1]).length,1);J.studioEnsureCues(p);const id=J.studioDuplicateCue(p,1),records=Object.values(p.studio.deletedObjects);assert.equal(records.length,2);assert.equal(records.filter(r=>r.owner==='cue-'+id).length,1);J.deleteLayerCue(p,p.subtitleCues.findIndex(c=>c.id===id));assert.equal(Object.keys(p.studio.deletedObjects).length,1);
});
test('manual instrumental effect deletion preserves auto FX, regions and original cues',()=>{
 const p=fixture(),F=J.InstrumentalFX,s=p.studio.instrumentalFx;s.manualEffects=[F.effect({id:'manual-one',type:'Geometry Motion',start:0,end:2}),F.effect({id:'manual-two',start:0,end:2})];s.autoEffects=[F.effect({id:'auto-one',start:0,end:2},'auto')];const cues=copy(p.subtitleCues),regions=copy(s.regions);assert(J.deleteSelectedObject(p,{kind:'instrumental',source:'manual',id:'manual-one'}));assert.deepEqual(s.manualEffects.map(e=>e.id),['manual-two']);assert.deepEqual(s.autoEffects.map(e=>e.id),['auto-one']);assert.deepEqual(copy(s.regions),regions);assert.deepEqual(copy(p.subtitleCues),cues);s.manualEffects[0].locked=true;assert(!J.deleteSelectedObject(p,{kind:'instrumental',source:'manual',id:'manual-two'}));
});
test('mixed filler subplans share deletion records and target ownership',()=>{
 const p=fixture();p.subtitleCues[0].filler=true;const t=target(p,'cut',1);assert(t);J.deleteSelectedObject(p,t);const plan=J.plan(p),g=plan.layerGroups.find(g=>g.kind==='normal');assert(g);assert.equal(Object.keys(g.plan.studio.deletedObjects).length,1);assert.equal(J.deletionRecords(g.plan,g.plan.lines[0]).length,1);
});
test('paint suppression retains layout result, capture state and original canvas methods even on failure',()=>{
 const events=[],ctx={fillText:()=>events.push('paint'),fill:()=>events.push('fill')},env={ctx,glyphLog:[]},original=ctx.fillText;J.studioCapturing=true;J.partCapturing=true;const log=env.glyphLog;
 const result=J.withDeletedPaint(env,()=>{ctx.fillText();ctx.fill();assert.equal(env.glyphLog,null);assert.equal(J.studioCapturing,false);return {x0:5,x1:90};});assert.deepEqual(result,{x0:5,x1:90});assert.deepEqual(events,[]);assert.equal(ctx.fillText,original);assert.equal(env.glyphLog,log);assert.equal(J.partCapturing,true);
 assert.throws(()=>J.withDeletedPaint(env,()=>{throw Error('draw failed');}));assert.equal(ctx.fillText,original);assert.equal(J.studioCapturing,true);
});
