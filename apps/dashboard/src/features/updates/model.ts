export type UpdateStatus = 'idle' | 'web' | 'checking' | 'latest' | 'available' | 'downloading' | 'verifying' | 'ready' | 'installing' | 'error' | 'unsupported';
export interface UpdateState {
  status: UpdateStatus; current?: string; version?: string; lastCheckedAt?: number;
  transfer?: 'planning' | 'delta' | 'full'; fallback?: boolean; error?: string; retry?: string;
  received?: number; size?: number; percent?: number; reused?: number; downloadSize?: number; fullSize?: number;
}
export interface DesktopKitState { startupAvailable:boolean; openAtLogin:boolean; shortcut:boolean; awake:boolean }
export type ClipboardSnapshot={enabled:boolean;error?:string;items:{id:string;text:string;at:number}[]};
export type RenameOptions={prefix:string;suffix:string;find:string;replacement:string;numbering:boolean;start:number};
export type MiniFocus={remaining:number;deadline:number|null};
export type MiniTask={id:string;userId:string;workspaceId:string;projectId:string;environment:string;title:string;project:string;done:number;total:number};
export interface DesktopUpdates {
  miniOpen?:()=>Promise<boolean>;
  miniFocus?:(value:MiniFocus)=>Promise<void>;
  miniTask?:(value:MiniTask|null)=>Promise<void>;
  onMiniFocus?:(callback:(value:MiniFocus)=>void)=>()=>void;
  onMiniNavigate?:(callback:(target:{page?:string;tool?:string})=>void)=>()=>void;
  clipboardState?:()=>Promise<ClipboardSnapshot>;
  clipboardEnabled?:(value:boolean)=>Promise<ClipboardSnapshot>;
  clipboardClear?:()=>Promise<ClipboardSnapshot>;
  clipboardCopy?:(id:string)=>Promise<boolean>;
  filePick?:()=>Promise<{id:string;files:{id:string;name:string}[]}|null>;
  fileApply?:(id:string,options:RenameOptions)=>Promise<{cancelled?:boolean;count?:number;undoId?:string}>;
  fileUndo?:(id:string)=>Promise<{count:number}>;
  captureScreens?:()=>Promise<{id:string;name:string;image:string}[]>;
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
