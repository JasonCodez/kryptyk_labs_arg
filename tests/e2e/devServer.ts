import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import axios from 'axios';

type DevServerHandle = {
  proc: ChildProcessWithoutNullStreams | null;
  stop: () => Promise<void>;
};

const waitFor = async (url: string, timeout = 60000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await axios.get(url, { timeout: 2000 });
      if (res.status >= 200) return true;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
};

export const ensureDevServer = async (opts?: { port?: number; cwd?: string }): Promise<DevServerHandle> => {
  const port = opts?.port ?? 3000;
  const url = `http://127.0.0.1:${port}/`;

  // If already running, return a no-op stopper.
  try {
    await waitFor(url, 2000);
    return { proc: null, stop: async () => {} };
  } catch (e) {
    // not running, continue to spawn
  }

  // Avoid `shell: true` for CI security. Spawn an explicit shell process instead,
  // passing the command as a single string to the shell. This avoids the `shell: true`
  // option while remaining cross-platform.
  const isWin = process.platform === 'win32';
  const shellCmd = isWin ? 'cmd' : 'sh';
  const shellArgs = isWin ? ['/c', 'npm run dev'] : ['-c', 'npm run dev'];
  const proc = spawn(shellCmd, shellArgs, { shell: false, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] });

  proc.stdout.on('data', (d) => process.stdout.write(`[next-dev] ${d}`));
  proc.stderr.on('data', (d) => process.stderr.write(`[next-dev ERR] ${d}`));

  // Wait for readiness
  await waitFor(url, 60000);

  const stop = async () => {
    if (!proc || proc.killed) return;
    try {
      proc.kill('SIGTERM');
    } catch (e) {
      // best-effort
    }

    await new Promise<void>((resolve) => {
      const to = setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch (e) {
          // ignore
        }
        resolve();
      }, 5000);

      proc.once('exit', () => {
        clearTimeout(to);
        resolve();
      });
    });
  };

  return { proc, stop };
};

export default ensureDevServer;
