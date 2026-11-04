'use strict';
const CHECK_INTERVAL = 10 * 60 * 1000;
// Lives in Electron main: renderer throttling, navigation and hidden windows do not stop checks.
function startUpdateChecks(updater, { every = setInterval, clear = clearInterval, now = Date.now } = {}) {
  if (updater.snapshot().status === 'unsupported') return { wake() {}, stop() {} };
  let stopped = false;
  const check = () => { if (!stopped) return updater.check().catch(() => {}); };
  const wake = () => {
    const last = updater.snapshot().lastAttemptAt;
    if (last == null || now() - last >= CHECK_INTERVAL) return check();
  };
  const timer = every(check, CHECK_INTERVAL); timer?.unref?.();
  void check();
  return { wake, stop() { stopped = true; clear(timer); } };
}
module.exports = { CHECK_INTERVAL, startUpdateChecks };
