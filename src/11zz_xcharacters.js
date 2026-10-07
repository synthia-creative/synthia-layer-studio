/* Manual transforms compose with existing animation; no alternate render engine. */
(() => {
'use strict';
const num=(v,d,lo,hi)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,v)):d;
J.studioTransform=v=>({x:num(v?.x,0,-10000,10000),y:num(v?.y,0,-10000,10000),scale:num(v?.scale,1,.05,10),rotation:num(v?.rotation,0,-360,360),opacity:num(v?.opacity,1,0,1),kerning:num(v?.kerning,0,-500,500)});
J.normalizeStudioCharacters=value=>{const out={};if(!value||typeof value!=='object')return out;for(const [key,row] of Object.entries(value).slice(0,20000)){if(!row||typeof row!=='object'||!/^line-\d+$|^cue-.{1,100}$/.test(key)||['__proto__','constructor','prototype'].includes(key))continue;const glyphs={};for(const [i,t] of Object.entries(row.glyphs||{}).slice(0,2000))if(/^\d{1,5}$/.test(i))glyphs[i]=J.studioTransform(t);out[key]={line:J.studioTransform(row.line),glyphs};}return out;};
J.studioLineKey=line=>line?.cueId?'cue-'+line.cueId:'line-'+line.index;
J.studioGlyphHits=[];
const draw=J.drawItem;
J.drawItem=(env,it)=>{
 const studio=env.plan?.studio,line=env.plan?.lines?.find(l=>l.index===env.cut?.line);
 if(!studio?.flags?.characterEditing||!line||env.bgOnly||env.inLayer||it._studioApplied||!it.text||!env.cut.text?.includes(it.text))return draw(env,it);
 const key=J.studioLineKey(line),row=studio.characters[key],base=J.studioTransform(row?.line),offset=Math.max(0,line.text.indexOf(it.text)),old=it.charFn;
 const changed={...it,_studioApplied:true,x:it.x+base.x,y:it.y+base.y,rot:(it.rot||0)+base.rotation,sx:(it.sx||1)*base.scale,sy:(it.sy||1)*base.scale,alpha:(it.alpha??1)*base.opacity,charFn:(i,g,n)=>{const a=old?.(i,g,n)||{},b=J.studioTransform(row?.glyphs[i+offset]);return {...a,dx:(a.dx||0)+b.x+base.kerning*i+b.kerning,dy:(a.dy||0)+b.y,s:(a.s??1)*b.scale,rot:(a.rot||0)+b.rotation,a:(a.a??1)*b.opacity};}};
 return draw({...env,studioGlyph:(g,m)=>{if(J.studioCapturing&&env.pass==='main')J.studioGlyphHits.push({key,index:g.i+offset,ch:g.ch,x:m.e,y:m.f,w:Math.max(12,Math.hypot(m.a,m.b)*g.w),h:Math.max(12,Math.hypot(m.c,m.d)*g.h)});}},changed);
};
})();
