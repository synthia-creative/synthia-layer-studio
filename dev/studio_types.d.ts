// Incremental contracts: existing engine APIs stay behind the legacy bridge.
interface StudioTransform {x:number;y:number;scale:number;rotation:number;opacity:number;kerning:number;}
interface StudioState { flags: Record<string, boolean>; tapGap: number; blankLines: 'keep' | 'skip'; characters:Record<string,{line:StudioTransform;glyphs:Record<string,StudioTransform>}>; }
interface StudioInput { flags?: Record<string, boolean>; tapGap?: number; blankLines?: string; characters?:StudioState['characters']; }
interface StudioCue { start:number; end:number; text:string; id?:string; }
interface StudioProject { studio?:StudioState; timing:{lineTimes:Record<string,number>}; subtitleCues?:StudioCue[]; }
interface StudioLine { start:number; end:number; visEnd?:number; index?:number; text?:string; cueId?:string; }
interface StudioCut extends StudioLine { line:number; layout:string; dur:number; inDur:number; outDur:number; }
interface StudioPlan { lines:StudioLine[]; cuts:StudioCut[]; }
declare const J: {
 [legacy:string]: any;
 STUDIO_FEATURES:string[];
 normalizeStudio:(value?:StudioInput)=>StudioState;
 studioOn:(project:Partial<StudioProject>|null|undefined,feature:string)=>boolean;
 studioTap:(lineTimes:Record<string,number>,index:number,time:number,count:number)=>{before:Record<string,number>;next:Record<string,number>;index:number};
 studioTapGap:(plan:StudioPlan,project:StudioProject)=>StudioPlan;
 studioElement:<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string|null,id?:string)=>HTMLElementTagNameMap[K];
 studioButton:(id:string,ja:string,en:string,action:()=>any)=>HTMLButtonElement;
 studioSection:(flag:string,ja:string,en:string)=>HTMLDetailsElement;
 studioChanged:()=>void;
 studioPlanCues:(plan:StudioPlan)=>StudioCue[];
 studioSRT:(cues:StudioCue[])=>string;
 studioLRC:(cues:StudioCue[])=>string;
 studioParseLRC:(raw:string,duration?:number,gap?:number)=>StudioCue[];
 studioPasteLyrics:(raw:string,keep:boolean)=>string;
};
