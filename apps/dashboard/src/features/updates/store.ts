import type { UpdateState } from './model';
let snapshot: UpdateState = { status: window.snapkitDesktop ? 'idle' : 'web' };
const listeners = new Set<() => void>();
let polling = false, action = false, generation = 0;
let actionError: { status: UpdateState['status']; version?: string; message: string } | undefined;
export const updateStore = {
  getSnapshot: () => snapshot,
  subscribe: (notify: () => void) => { listeners.add(notify); return () => { listeners.delete(notify); }; },
  set(next: UpdateState) { if (JSON.stringify(snapshot) === JSON.stringify(next)) return; snapshot = next; listeners.forEach(notify => notify()); },
  async refresh() {
    const get = window.snapkitDesktop?.updateState;
    if (!get || polling || action) return;
    polling = true;
    const currentGeneration = generation;
    try {
      const next = await get();
      if (currentGeneration !== generation) return;
      if (actionError && next.status === actionError.status && next.version === actionError.version && !next.error) updateStore.set({ ...next, error: actionError.message });
      else { actionError = undefined; updateStore.set(next); }
    } catch { /* A temporary IPC failure retains known update state. */ }
    finally { polling = false; }
  },
  async perform(run: (() => Promise<UpdateState>) | undefined) {
    if (!run || action) return;
    action = true; generation++; actionError = undefined;
    try { updateStore.set(await run()); }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      actionError = { status: snapshot.status, version: snapshot.version, message };
      updateStore.set({ ...snapshot, error: message });
    }
    finally { action = false; }
  }
};
