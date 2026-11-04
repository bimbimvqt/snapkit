import { spawn } from 'node:child_process';
import { launch } from './cli.js';

export function releaseCommand(name, args, { cwd, env = process.env, signal, onOutput, timeout = 90 * 60000 } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Task cancelled.'));
    let child, force, settled = false, ended = false, reason = '';
    try { child = launch(name, args, { cwd, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (error) { reject(error); return; }
    const kill = hard => {
      if (ended) return;
      if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); killer.on('error', () => child.kill());
      } else { try { process.kill(-child.pid, hard ? 'SIGKILL' : 'SIGTERM'); } catch { child.kill(hard ? 'SIGKILL' : 'SIGTERM'); } }
    };
    const abort = () => { reason ||= 'Task cancelled.'; kill(false); force ||= setTimeout(() => kill(true), 3000); };
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { reason = 'Task timed out. Check the build log before retrying.'; abort(); }, timeout);
    const finish = error => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(); };
    child.stdout.on('data', chunk => onOutput?.(chunk.toString())); child.stderr.on('data', chunk => onOutput?.(chunk.toString()));
    child.once('error', error => { ended = true; clearTimeout(force); finish(error); });
    child.once('close', code => { ended = true; clearTimeout(force); finish(reason ? new Error(reason) : code === 0 ? null : new Error(`${name} exited with code ${code}. Check the build log.`)); });
  });
}
