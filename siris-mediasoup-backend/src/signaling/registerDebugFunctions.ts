import { logger } from "../infra/logger.js";
import type { WorkerPool } from "../mediasoup/workerPool.js";
import { SessionManager } from "../sessions/sessionManager.js";

type SocketAny = any;

export function registerDebugFunctions(
  socket: SocketAny,
  deps: { workerPool: WorkerPool; sessionManager: SessionManager }
) {

  if ((socket as any).__debugHandlersRegistered) return;
  (socket as any).__debugHandlersRegistered = true;

  // debug: retorna o PID do worker "mais livre" no momento
  socket.on("debug:leastWorker", async (_payload: any, cb?: (res: any) => void) => {
    try {
      const w = await deps.workerPool.getLeastLoadedWorker();
      cb?.({ ok: true, pid: w.pid });
    } catch (err: any) {
      cb?.({ ok: false, error: err?.message ?? "unknown_error" });
    }
  });

  socket.on("debug:sessions", (_payload: any, cb?: (res: any) => void) => {
    try {
      cb?.({ ok: true, sessions: deps.sessionManager.list() });
    } catch (err: any) {
      cb?.({ ok: false, error: err?.message ?? "unknown_error" });
    }
  });
}
