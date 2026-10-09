// Incremental contracts: existing engine APIs stay behind the legacy bridge.
type StudioControl = HTMLButtonElement|HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement;
declare const Mediabunny:{VideoSampleSink:new(track:unknown)=>{samplesAtTimestamps:(times:Iterable<number>)=>AsyncIterableIterator<unknown>}};
interface StudioTransform {x:number;y:number;scale:number;rotation:number;opacity:number;kerning:number;}
interface SubtitleGroupTransform {x:number;y:number;scale:number;rotation:number;}
interface StudioState {groups:Record<string,SubtitleGroupTransform>;groupLines:{id:string;text:string;index:number}[];partTransforms:Record<string,{owner:string;signature:string;kind:string;transform:SubtitleGroupTransform}>;}
interface StudioInput {groups?:StudioState['groups'];groupLines?:StudioState['groupLines'];partTransforms?:StudioState['partTransforms'];}
interface StudioState { flags: Record<string, boolean>; tapGap: number; blankLines: 'keep' | 'skip'; characters:Record<string,{line:StudioTransform;glyphs:Record<string,StudioTransform>}>; fontFiles:{key:string;label:string;data:string}[]; }
interface StudioInput { flags?: Record<string, boolean>; tapGap?: number; blankLines?: string; characters?:StudioState['characters']; fontFiles?:StudioState['fontFiles']; motion?:StudioMotion; }
interface StudioMotion {preset:string;controls:Record<string,number>;rows:Record<string,{enter:string;hold:string;exit:string;intensity:number}>;}
interface StudioState {motion:StudioMotion;}
interface StudioAnalysis {sections:{start:number;end:number;type:string}[];beatSnap:number;}
interface StudioState {analysis:StudioAnalysis;}
interface StudioInput {analysis?:StudioAnalysis;}
interface StudioLayer {id:string;type:string;name:string;start:number;end:number;blend:string;transform:StudioTransform;text:string;color:string;fileName:string;font:string;}
interface StudioState {layers:StudioLayer[];}
interface StudioInput {layers?:StudioLayer[];}
interface StudioState {output:{filename:string};}
interface StudioInput {output?:{filename:string};}
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
