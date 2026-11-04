export type UpdateStatus = 'idle' | 'web' | 'checking' | 'latest' | 'available' | 'downloading' | 'verifying' | 'ready' | 'installing' | 'error' | 'unsupported';
export interface UpdateState {
  status: UpdateStatus; current?: string; version?: string; lastCheckedAt?: number;
  transfer?: 'planning' | 'delta' | 'full'; fallback?: boolean; error?: string; retry?: string;
  received?: number; size?: number; percent?: number; reused?: number; downloadSize?: number; fullSize?: number;
}
export interface DesktopUpdates {
  ready?: () => void;
  updateState?: () => Promise<UpdateState>;
  checkUpdates?: () => Promise<UpdateState>; downloadUpdate?: () => Promise<UpdateState>;
  cancelUpdate?: () => Promise<UpdateState>; installUpdate?: () => Promise<UpdateState>;
  clearCache?: () => Promise<void>; setLanguage?: (language: string) => Promise<void>;
}
