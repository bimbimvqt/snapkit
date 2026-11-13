export type UpdateStatus = 'idle' | 'web' | 'checking' | 'latest' | 'available' | 'downloading' | 'verifying' | 'ready' | 'installing' | 'error' | 'unsupported';
export interface UpdateState {
  status: UpdateStatus; current?: string; version?: string; lastCheckedAt?: number;
  transfer?: 'planning' | 'delta' | 'full'; fallback?: boolean; error?: string; retry?: string;
  received?: number; size?: number; percent?: number; reused?: number; downloadSize?: number; fullSize?: number;
}
export interface DesktopKitState { startupAvailable:boolean; openAtLogin:boolean; shortcut:boolean; awake:boolean }
export type ClipboardSnapshot={enabled:boolean;error?:string;items:{id:string;text:string;at:number}[]};
export type MiniFocus={remaining:number;deadline:number|null};
export type PersonalTheme={id:string;name:string;scene:string;accent:string;background:string};
export type FocusExperience={space:string;themes:PersonalTheme[];plant:string;completed:number;totalSeconds:number;sessionSeconds:number;timer:MiniFocus};
export type FocusAction={type:'toggle'}|{type:'reset'|'duration';seconds:number}|{type:'space'|'plant';value:string}|{type:'theme:save';theme:PersonalTheme}|{type:'theme:delete';value:string};
export type MiniTask={id:string;userId:string;workspaceId:string;projectId:string;environment:string;title:string;project:string;done:number;total:number};
export interface DesktopUpdates {
  focusExperience?:(legacy?:MiniFocus)=>Promise<FocusExperience>;
  focusAction?:(value:FocusAction)=>Promise<FocusExperience>;
  onFocusExperience?:(callback:(value:FocusExperience)=>void)=>()=>void;
  miniOpen?:()=>Promise<boolean>;
  miniFocus?:(value:MiniFocus)=>Promise<void>;
  miniTask?:(value:MiniTask|null)=>Promise<void>;
  onMiniFocus?:(callback:(value:MiniFocus)=>void)=>()=>void;
  onMiniNavigate?:(callback:(target:{page?:string;tool?:string})=>void)=>()=>void;
  clipboardState?:()=>Promise<ClipboardSnapshot>;
  clipboardEnabled?:(value:boolean)=>Promise<ClipboardSnapshot>;
  clipboardClear?:()=>Promise<ClipboardSnapshot>;
  clipboardCopy?:(id:string)=>Promise<boolean>;
  kitSettings?:()=>Promise<DesktopKitState>;
  kitStartup?:(enabled:boolean)=>Promise<DesktopKitState>;
  kitAwake?:(enabled:boolean)=>Promise<DesktopKitState>;
  kitPickFiles?:()=>Promise<{files:import('../kit/types').KitFile[]}>;
  kitDropFiles?:(files:File[])=>Promise<{files:import('../kit/types').KitFile[]}>;
  kitReveal?:(id:string)=>Promise<boolean>;
  kitFolder?:(name:string)=>Promise<boolean>;
  kitFocus?:(deadline:number|null)=>Promise<boolean>;
  kitNotify?:()=>Promise<boolean>;
  onKitCommand?:(callback:()=>void)=>()=>void;
  ready?: () => void;
  updateState?: () => Promise<UpdateState>;
  checkUpdates?: () => Promise<UpdateState>; downloadUpdate?: () => Promise<UpdateState>;
  cancelUpdate?: () => Promise<UpdateState>; installUpdate?: () => Promise<UpdateState>;
  setAppearance?: (appearance: 'system' | 'light' | 'dark') => Promise<void>;
  clearCache?: () => Promise<void>; setLanguage?: (language: string) => Promise<void>;
}
