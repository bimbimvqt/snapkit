import type { UpdateState } from './model';
let snapshot: UpdateState = { status: window.snapkitDesktop ? 'idle' : 'web' };
const listeners = new Set<() => void>();
let polling = false, action = false;
export const updateStore = {
  getSnapshot: () => snapshot,
  subscribe: (notify: () => void) => { listeners.add(notify); return () => { listeners.delete(notify); }; },
  set(next: UpdateState) { if (JSON.stringify(snapshot) === JSON.stringify(next)) return; snapshot = next; listeners.forEach(notify => notify()); },
  async refresh() {
    const get = window.snapkitDesktop?.updateState;
    if (!get || polling || action) return;
    polling = true;
    try { updateStore.set(await get()); } catch { /* A temporary IPC failure retains known update state. */ }
    finally { polling = false; }
  },
  async perform(run: (() => Promise<UpdateState>) | undefined) {
    if (!run || action) return;
    action = true;
    try { updateStore.set(await run()); }
    catch (error) { updateStore.set({ ...snapshot, error: error instanceof Error ? error.message : String(error) }); }
    finally { action = false; }
  }
};
