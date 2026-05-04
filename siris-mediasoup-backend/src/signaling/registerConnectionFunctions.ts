import { logger } from "../infra/logger.js";
import type { SessionManager } from "../sessions/sessionManager.js";

type SocketAny = any;

export function registerConnectionFunctions(
  socket: SocketAny,
  deps: {sessionManager: SessionManager }
) {
  // evita registrar duas vezes se você chamar por engano
  if ((socket as any).__handlersRegistered) return;
  (socket as any).__handlersRegistered = true;

  socket.on("disconnect", (reason: string) => {
    logger.info("socket disconnected", { id: socket.id, reason });

    const sessionId = socket.data.sessionId;
    const serial = socket.data.seialNumber;

    console.log("socket ", socket.data);

    if(sessionId && serial){
      const session = deps.sessionManager.get(sessionId);
      session?.markDisconnected(serial);
    }
  });

}
