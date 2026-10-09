const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={window:{},document:{documentElement:{lang:'ja'},createElement:()=>({getContext:()=>({measureText:t=>({width:String(t).length*20})})})},console,structuredClone,crypto:require('node:crypto').webcrypto};
vm.createContext(sandbox);for(const n of fs.readdirSync(path.join(__dirname,'../src')).filter(n=>n.endsWith('.js')&&n<'12').sort())vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',n),'utf8'),sandbox);const J=sandbox.window.J,json=v=>JSON.parse(JSON.stringify(v));
const project=(cuts=1)=>{const p=J.defaultProject();p.seed=2;p.lyrics='夜明けの色を/覚えてる';p.timing.lineTimes={0:0};p.overrides[0]={cuts,layout:'tape',enter:'fade',exit:'fade',hold:'still',cam:'none',decor:[],treat:'none'};return p;};
test('temporal cuts are independently identified by complete topology and persistent IDs',()=>{
 const p=project(2),plan=J.plan(p,null),cuts=plan.effectTargets.filter(t=>t.kind==='cut');assert.equal(cuts.length,2);assert.equal(cuts[0].text,'夜明けの色を');assert.equal(cuts[1].text,'覚えてる');
 const id=J.setEffectTransform(p,cuts[1],{x:.1,scale:1.5,rotation:-20}),next=J.plan(p,null);assert(id.startsWith('part-'));assert.equal(next.effectTargets.find(t=>t.id===id).transform.rotation,-20);assert.equal(next.effectTargets.find(t=>t.text==='夜明けの色を'&&t.kind==='cut').transform.x,0);
});
test('simultaneous tape blocks have explicit independent ownership',()=>{
 const p=project(),parts=J.plan(p,null).effectTargets.filter(t=>t.kind==='part');assert.equal(parts.length,3);assert.equal(parts[2].text,'覚えてる');const id=J.setEffectTransform(p,parts[2],{x:.15,y:.08,scale:1.25,rotation:17}),next=J.plan(p,null);assert.equal(next.effectTargets.find(t=>t.id===id).transform.scale,1.25);assert(next.effectTargets.filter(t=>t.id!==id).every(t=>J.groupIsIdentity(t.transform)));
});
test('invalid records sanitize while old JSON defaults to exact identity',()=>{
 assert.deepEqual(json(J.normalizeStudio().partTransforms),{});const normalized=J.normalizeEffectTransforms({'part-good':{owner:'cue-a',signature:'s',kind:'part',transform:{x:Infinity,scale:-1,rotation:NaN}},constructor:{},'part-bad':{owner:'line-1',signature:'s',kind:'part'}});assert.deepEqual(Object.keys(normalized),['part-good']);assert(J.groupIsIdentity(normalized['part-good'].transform));
});
test('JSON roundtrip and timing/color/font edits keep matching settings',()=>{
 const p=project(),t=J.plan(p,null).effectTargets.find(t=>t.slot==='tape-row-2'),id=J.setEffectTransform(p,t,{x:.1,rotation:10});const q=JSON.parse(JSON.stringify(p));J.upgradeLayerProject(q,q);q.timing.lineTimes[0]=2;q.colors={enabled:false};q.fonts={...q.fonts,display:'gothic_black'};const plan=J.plan(q,null);assert.equal(plan.effectTargets.find(t=>t.id===id).transform.rotation,10);assert.equal(plan.suspendedEffectTransforms.length,0);
});
test('topology changes suspend unmatched settings without deleting or changing parent values',()=>{
 const p=project(),plan=J.plan(p,null),id=J.setEffectTransform(p,plan.effectTargets.find(t=>t.slot==='tape-row-2'),{x:.2});const group=JSON.stringify(p.studio.groups);p.overrides[0].cuts=2;const next=J.plan(p,null);assert(next.suspendedEffectTransforms.includes(id));assert(!next.effectTargets.some(t=>t.id===id));assert.equal(p.studio.partTransforms[id].transform.x,.2);assert.equal(JSON.stringify(p.studio.groups),group);p.overrides[0].cuts=1;assert(J.plan(p,null).effectTargets.some(t=>t.id===id));
});
test('native subtitles keep transformed identities across reorder and cue migration',()=>{
 const p=project();p.lyrics+='\n別の行';const id=J.setEffectTransform(p,J.plan(p,null).effectTargets.find(t=>t.slot==='tape-row-2'),{rotation:15});p.lyrics='別の行\n夜明けの色を/覚えてる';p.overrides[1]=p.overrides[0];p.timing.lineTimes={0:0,1:3};assert.equal(J.plan(p,null).effectTargets.find(t=>t.id===id).line,1);
 J.ui={audio:null};J.studioEnsureCues(p);assert(J.plan(p,null).effectTargets.some(t=>t.id===id));
});
test('duplicate and delete isolate child settings using new IDs',()=>{
 const p=project();J.ui={audio:null};J.studioEnsureCues(p);const id=J.setEffectTransform(p,J.plan(p,null).effectTargets[0],{x:.2});const dup=J.studioDuplicateCue(p,0),rows=Object.entries(p.studio.partTransforms).filter(([,r])=>r.owner==='cue-'+dup);assert.equal(rows.length,1);assert.notEqual(rows[0][0],id);rows[0][1].transform.x=.4;assert.equal(p.studio.partTransforms[id].transform.x,.2);J.deleteLayerCue(p,p.subtitleCues.findIndex(c=>c.id===dup));assert.equal(Object.keys(p.studio.partTransforms).length,1);
});
test('repeated captions and repeated labels never share target identities',()=>{
 const p=project();p.lyrics='ああ\nああ';p.overrides[0].layout='labels';p.overrides[1]={...p.overrides[0]};const targets=J.plan(p,null).effectTargets;assert.equal(new Set(targets.map(t=>t.id)).size,targets.length);const t=targets.find(t=>t.kind==='part'&&t.line===1),id=J.setEffectTransform(p,t,{rotation:10}),next=J.plan(p,null);assert.equal(next.effectTargets.find(t=>t.id===id).line,1);assert(next.effectTargets.filter(t=>t.line===0).every(t=>J.groupIsIdentity(t.transform)));
});
test('subtitle locks block edits and corrupt selection does not mutate project',()=>{
 const p=project(),t=J.plan(p,null).effectTargets[0];p.overrides[0].lock=true;assert.equal(J.setEffectTransform(p,t,{x:.1}),null);assert.equal(J.setEffectTransform(p,null,{x:.1}),null);assert.equal(Object.keys(p.studio.partTransforms).length,0);
});
test('unsupported subdivision keeps whole cut targets and shared decorations are cut owned',()=>{
 const p=project();p.overrides[0].layout='cube';const targets=J.plan(p,null).effectTargets;assert.equal(targets.length,1);assert.equal(targets[0].kind,'cut');assert.equal(targets[0].supported,false);assert.equal(J.groupDecorationScope('stripes'),'screen');assert.equal(J.groupDecorationScope('brackets'),'subtitle');
});
test('parent-child matrices compose without changing sibling matrices or output proportions',()=>{
 for(const [W,H]of[[480,270],[1920,1080],[1080,1920]]){const anchor={x:W*.5,y:H*.6},parent=J.groupMatrix({x:.1,scale:1.5,rotation:30},anchor,W,H),child=J.groupMatrix({x:.2,y:.05,scale:1.25,rotation:-20},anchor,W,H),p=J.groupPoint(J.groupMultiply(parent,child),anchor),expected=J.groupPoint(parent,J.groupPoint(child,anchor));assert(Math.abs(p.x-expected.x)<1e-7);assert(Math.abs(p.y-expected.y)<1e-7);const back=J.groupInversePoint(parent,p);assert(Math.abs(back.x-anchor.x-.2*W)<1e-7);}
});
test('motion recipes exclude child records and keep project-local values safely',()=>{
 const p=project(),id=J.setEffectTransform(p,J.plan(p,null).effectTargets.find(t=>t.slot==='tape-row-2'),{x:.2}),recipe=J.captureMotionRecipe(p,J.plan(p,null),0);assert(!JSON.stringify(recipe).includes(id));assert(!JSON.stringify(recipe).includes('_effect'));const next=J.prepareMotionApply(p,J.plan(p,null),0,recipe);assert.equal(next.studio.partTransforms[id].transform.x,.2);assert.equal(Object.keys(next.studio.partTransforms).length,1);
});
test('mixed filler subplans carry global target IDs, studio data and correct subtitle numbers',()=>{
 const p=project();p.subtitleCues=[{id:'fill',start:0,end:1,text:'Filler',filler:true},{id:'normal',start:1,end:4,text:'夜明けの色を覚えてる'}];p.studio.flags.characterEditing=true;p.overrides[1]={...p.overrides[0]};let plan=J.plan(p,null);assert(plan.layerGroups?.length);const t=plan.effectTargets.find(t=>t.owner==='cue-normal'&&t.kind==='cut'),id=J.setEffectTransform(p,t,{x:.15});plan=J.plan(p,null);const g=plan.layerGroups.find(g=>g.kind==='normal');assert.equal(g.plan.cuts[0]._effectCut.id,id);assert.equal(g.plan.cuts[0]._effectCut.line,1);assert(g.plan.cuts[0].studioCharacterMap.length);assert.equal(g.plan.studio.partTransforms[id].transform.x,.15);
});
test('stale target from deleted/regenerated topology is rejected without data mutation',()=>{
 const p=project(),t=J.plan(p,null).effectTargets.find(t=>t.kind==='part');p.overrides[0].cuts=2;const before=JSON.stringify(p);assert.equal(J.setEffectTransform(p,t,{x:.1}),null);assert.equal(JSON.stringify(p),before);
});
test('repeated label slots carry distinct character offsets without ownership inference',()=>{
 const specs=J.effectPartSpecs({layout:'labels',text:'ああ',params:{unit:'char',variant:'rows',center:'none'}},1920,1080);assert.equal(specs[0].glyphStart,0);assert.equal(specs[1].glyphStart,1);assert.notEqual(specs[0].slot,specs[1].slot);
});
test('font/color-only gacha keeps exact active part identity and values',()=>{
 const p=project(),id=J.setEffectTransform(p,J.plan(p,null).effectTargets.find(t=>t.slot==='tape-row-2'),{rotation:12});
 for(const mode of ['font','color']){const next=J.prepareCueReroll(p,J.plan(p,null),0,null,mode),target=J.plan(next,null).effectTargets.find(t=>t.id===id);assert(target,mode);assert.equal(target.transform.rotation,12);}
});
