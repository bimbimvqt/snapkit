import { useSyncExternalStore } from 'react';
const subscribe = (notify: () => void) => { document.addEventListener('snapkit:language', notify); return () => document.removeEventListener('snapkit:language', notify); };
export const useLanguage = () => useSyncExternalStore(subscribe, () => window.SnapkitI18n.language);
export const t = (key: string, values?: (string | number)[]) => window.SnapkitI18n.t(key, values);
