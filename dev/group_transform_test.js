const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={window:{},document:{documentElement:{lang:'ja'},createElement:()=>({getContext:()=>({measureText:t=>({width:String(t).length*20})})})},console,structuredClone,crypto:require('node:crypto').webcrypto};
vm.createContext(sandbox);for(const n of fs.readdirSync(path.join(__dirname,'../src')).filter(n=>n.endsWith('.js')&&n<'12').sort())vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',n),'utf8'),sandbox);const J=sandbox.window.J,json=v=>JSON.parse(JSON.stringify(v));
test('group transforms sanitize corrupt numeric data without disabling old projects',()=>{
  assert.deepEqual(json(J.groupTransform({x:NaN,y:Infinity,scale:0,rotation:'bad'})),{x:0,y:0,scale:1,rotation:0});
  assert.equal(J.groupTransform({scale:-1}).scale,1);assert.equal(J.groupTransform({scale:1000}).scale,10);assert.equal(J.groupTransform({x:10}).x,4);
  assert.deepEqual(json(J.normalizeStudio().groups),{});assert.deepEqual(Object.keys(J.normalizeSubtitleGroups({'__proto__':{},constructor:{},bad:{},'cue-good':{scale:1.5}})),['cue-good']);
});
test('parent matrix has a shared visual pivot and invertible coordinates at all output sizes',()=>{
  const p={x:.1,y:-.2,scale:1.5,rotation:90};
  for(const [W,H]of[[1920,1080],[1080,1920],[854,480],[3840,2160]]){
    const c={x:W*.4,y:H*.55},m=J.groupMatrix(p,c,W,H),center=J.groupPoint(m,c);assert(Math.abs(center.x-c.x-W*.1)<1e-8);assert(Math.abs(center.y-c.y+H*.2)<1e-8);
    const v={x:W*.25,y:H*.7},back=J.groupInversePoint(m,J.groupPoint(m,v));assert(Math.abs(back.x-v.x)<1e-8);assert(Math.abs(back.y-v.y)<1e-8);
    const a=J.groupPoint(m,{x:c.x+100,y:c.y}),b=J.groupPoint(m,c);assert(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-150)<1e-8);
  }
});
test('identity transformation preserves rendering matrices exactly',()=>{
  const c={x:192,y:90},m=J.groupMatrix(null,c,384,216);assert.deepEqual(json(J.groupMultiply(m,{a:2,b:.1,c:-.1,d:2,e:13,f:27})),{a:2,b:.1,c:-.1,d:2,e:13,f:27});assert(J.groupIsIdentity(J.groupTransform()));
});
test('cue groups survive reorder, duplication, deletion, JSON, style/font and auto changes',()=>{
  const p=J.defaultProject();p.subtitleCues=[{id:'a',start:0,end:2,text:'First'},{id:'b',start:2,end:4,text:'Second'}];p.studio.groups['cue-a']=J.groupTransform({x:.1,scale:1.5,rotation:20});p.studio.characters['cue-a']={line:J.studioTransform({y:15}),glyphs:{0:J.studioTransform({rotation:11})}};
  J.moveLayerCue(p,0,5);assert.equal(p.subtitleCues[1].id,'a');assert.equal(J.plan(p,null).studio.groups['cue-a'].rotation,20);
  const id=J.studioDuplicateCue(p,1);assert.deepEqual(json(p.studio.groups['cue-'+id]),json(p.studio.groups['cue-a']));p.studio.groups['cue-'+id].x=.4;assert.equal(p.studio.groups['cue-a'].x,.1);
  const q=JSON.parse(JSON.stringify(p));J.upgradeLayerProject(q,q);assert.equal(q.studio.groups['cue-a'].scale,1.5);
  for(const style of ['magenta','paper','hud','noir']){q.style=style;q.seed++;q.fonts={display:'gothic_black'};assert.equal(J.plan(q,null).studio.groups['cue-a'].scale,1.5);}
  const oldCharacters=JSON.stringify(q.studio.characters);J.deleteLayerCue(q,q.subtitleCues.findIndex(c=>c.id===id));assert.equal(q.studio.groups['cue-'+id],undefined);assert.equal(JSON.stringify(q.studio.characters),oldCharacters);
});
test('group reset and flag switching leave glyph, line, motion and timing data independent',()=>{
  const p=J.defaultProject();p.subtitleCues=[{id:'a',start:0,end:2,text:'One'}];p.studio.groups['cue-a']=J.groupTransform({x:.2,scale:2,rotation:-30});p.studio.characters['cue-a']={line:J.studioTransform({x:10}),glyphs:{0:J.studioTransform({rotation:17})}};const chars=JSON.stringify(p.studio.characters),cues=JSON.stringify(p.subtitleCues);
  p.studio.flags.characterEditing=false;assert.equal(J.plan(p,null).studio.groups['cue-a'].rotation,-30);p.studio.groups['cue-a']=J.groupTransform();assert.equal(JSON.stringify(p.studio.characters),chars);assert.equal(JSON.stringify(p.subtitleCues),cues);
});
test('locked cues and protected backgrounds are classified using actual engine fields',()=>{
  const p=J.defaultProject(),line={index:0,cueId:'x'};p.overrides[0]={lock:true};assert(J.groupLocked(p,line));p.overrides[0].lock=false;assert.equal(J.groupLocked(p,line),false);assert.equal(J.groupDecorationScope('stripes'),'screen');assert.equal(J.groupDecorationScope('grid'),'screen');assert.equal(J.groupDecorationScope('counter'),'subtitle');assert.equal(J.groupDecorationScope('brackets'),'subtitle');assert.equal(J.groupDecorationScope('decoCorners'),'screen');assert.equal(J.groupDecorationScope('indexTabs'),'subtitle');
});
test('untimed groups keep stable IDs across reordering, regeneration and conversion to cues',()=>{
  const p=J.defaultProject();p.lyrics='First line\nSecond line';p.studio=J.normalizeStudio(p.studio);let plan=J.plan(p,null);
  const key=J.setSubtitleGroup(p,plan.lines[0],{x:.15,scale:1.4,rotation:17});assert(key.startsWith('cue-group-'));assert.equal(p.studio.groupLines.length,1);
  p.overrides={};p.seed++;p.lyrics='Second line\nFirst line';plan=J.plan(p,null);assert.equal(J.subtitleGroupKey(plan.lines.find(l=>l.text==='First line')),key);assert.equal(plan.studio.groups[key].rotation,17);
  const copy=JSON.parse(JSON.stringify(p));J.upgradeLayerProject(copy,copy);assert.equal(J.subtitleGroupKey(J.plan(copy,null).lines.find(l=>l.text==='First line')),key);
  J.ui={audio:null};const cues=J.studioEnsureCues(copy),cue=cues.find(c=>c.text==='First line');assert.equal(copy.studio.groups['cue-'+cue.id].scale,1.4);assert.equal(copy.studio.groups[key],undefined);
});
test('center-free rendering measures both real cuts, including the boolean companion marker',()=>{
  const measure=J.subtitleGroupBounds,old=J.LAYOUTS.__groupTest;
  const parent={line:0,layout:'__groupTest',zone:{x:0,y:0,w:300,h:540}},twin={line:0,layout:'__groupTest',zone:{x:1620,y:0,w:300,h:540},companion:true};parent.companion=twin;
  const matrices=[],ctx={canvas:{width:1920,height:1080},save(){},restore(){},getTransform(){return{a:1,b:0,c:0,d:1,e:0,f:0};},setTransform(...m){matrices.push(m);}};
  const plan={W:1920,H:1080,lines:[{index:0,cueId:'a',text:'same'}],cuts:[parent],studio:{groups:{'cue-a':J.groupTransform({scale:1.5,rotation:20})}}};
  try{J.LAYOUTS.__groupTest={render:()=>null};J.subtitleGroupBounds=(r,e)=>{assert.equal(typeof e.cut,'object');assert([parent,twin].includes(e.cut));return{x0:50,y0:100,x1:250,y1:400};};
    for(const cut of[parent,twin])J.Renderer.prototype.drawCut.call({makeEnv:(ctx,plan,cut,sc,o)=>({...o,ctx,plan,cut,sc})}, {ctx,plan,cut,zone:cut.zone,scale:1});assert.deepEqual(matrices[0],matrices[1]);
  }finally{J.subtitleGroupBounds=measure;if(old)J.LAYOUTS.__groupTest=old;else delete J.LAYOUTS.__groupTest;}
});
test('editing a later identical untimed line does not attach its transform to the first occurrence',()=>{
  const p=J.defaultProject();p.lyrics='Repeat\nRepeat';const plan=J.plan(p,null),key=J.setSubtitleGroup(p,plan.lines[1],{rotation:30});const next=J.plan(p,null);
  assert.equal(J.subtitleGroupKey(next.lines[1]),key);assert.notEqual(J.subtitleGroupKey(next.lines[0]),key);assert.equal(next.studio.groups[key].rotation,30);
});
