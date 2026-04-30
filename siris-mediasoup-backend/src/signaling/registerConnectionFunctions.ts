import { logger } from "../infra/logger.js";

type SocketAny = any;

export function registerConnectionFunctions(socket: SocketAny) {
  // evita registrar duas vezes se você chamar por engano
  if ((socket as any).__handlersRegistered) return;
  (socket as any).__handlersRegistered = true;

  socket.on("disconnect", (reason: string) => {
    logger.info("socket disconnected", { id: socket.id, reason });
  });

}
