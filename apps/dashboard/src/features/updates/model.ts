export type UpdateStatus = 'idle' | 'web' | 'checking' | 'latest' | 'available' | 'downloading' | 'verifying' | 'ready' | 'installing' | 'error' | 'unsupported';
export interface UpdateState {
  status: UpdateStatus; current?: string; version?: string; lastCheckedAt?: number;
  transfer?: 'planning' | 'delta' | 'full'; fallback?: boolean; error?: string; retry?: string;
  received?: number; size?: number; percent?: number; reused?: number; downloadSize?: number; fullSize?: number;
}
export interface DesktopKitState { startupAvailable:boolean; openAtLogin:boolean; shortcut:boolean; awake:boolean }
export interface DesktopUpdates {
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
