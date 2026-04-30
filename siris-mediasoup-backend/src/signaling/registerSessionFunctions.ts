// src/socket/registerSessionFunctions.ts
import { logger } from "../infra/logger.js";
import type { SessionManager } from "../sessions/sessionManager.js";

type SocketAny = any;

/**
 * Assumptions:
 * - serialNumber is already available in socket.data.serialNumber (set by auth middleware)
 * - client calls "session:join" with { sessionId }
 * - server returns via ack callback: (resp) or (err)
 */
export function registerSessionFunctions(
  socket: SocketAny,
  deps: { sessionManager: SessionManager }
) {
  if ((socket as any).__sessionHandlersRegistered) return;
  (socket as any).__sessionHandlersRegistered = true;

  socket.on("session:join", async (payload: any, ack?: Function) => {
    let sessionId = "";
    let serialNumber = "";
    try {
      sessionId = String(payload?.sessionId || "").trim();
      serialNumber = String(payload?.serialNumber || "").trim();

      socket.data.sessionId = sessionId;
      socket.data.serialNumber = serialNumber;

      console.log(`new user joining session: ${sessionId} with serial: ${serialNumber}`);

      if (!sessionId) throw new Error("MISSING_SESSION_ID");
      if (!serialNumber) throw new Error("MISSING_SERIAL");

      socket.join(sessionId);
      
      // store for disconnect cleanup
      socket.data.sessionId = sessionId;

      const joinResult = await deps.sessionManager.joinRoom({
        sessionId,
        serialNumber,
      });

      ack?.({ ok: true, ...joinResult });
    } catch (e: any) {
      const code = String(e?.message || "JOIN_FAILED");

      logger.warn("session join failed", {
        socketId: socket.id,
        sessionId: sessionId,
        serialNumber: serialNumber,
        code,
      });

      ack?.({ ok: false, code });

      // policy: if missing serial or already connected => disconnect hard
      if (code === "MISSING_SERIAL" || code === "SERIAL_ALREADY_CONNECTED") {
        try {
          socket.disconnect(true);
        } catch {}
      }
    }
  });


  socket.on("session:joinPlain", async (payload: any, ack?: Function) => {
    let sessionId = "";
    let serialNumber = "";
    try {
      sessionId = String(payload?.sessionId || "").trim();
      serialNumber = String(payload?.serialNumber || "").trim();

      socket.data.sessionId = sessionId;
      socket.data.serialNumber = serialNumber;

      console.log(`new user joining session: ${sessionId} with serial: ${serialNumber}`);

      if (!sessionId) throw new Error("MISSING_SESSION_ID");
      if (!serialNumber) throw new Error("MISSING_SERIAL");

      socket.join(sessionId);
      
      // store for disconnect cleanup
      socket.data.sessionId = sessionId;

      const joinResult = await deps.sessionManager.joinPlainRoom({
        sessionId,
        serialNumber,
      });

      ack?.({ ok: true, ...joinResult });
    } catch (e: any) {
      const code = String(e?.message || "JOIN_FAILED");

      logger.warn("session join failed", {
        socketId: socket.id,
        sessionId: sessionId,
        serialNumber: serialNumber,
        code,
      });

      ack?.({ ok: false, code });

      // policy: if missing serial or already connected => disconnect hard
      if (code === "MISSING_SERIAL" || code === "SERIAL_ALREADY_CONNECTED") {
        try {
          socket.disconnect(true);
        } catch {}
      }
    }
  });

  socket.on("session:left", async (reason: string) => {
    try {
      const sessionId = String(socket.data?.sessionId || "").trim();
      const serialNumber = String(socket.data?.serialNumber || "").trim();
      const connectionId = String(socket.id);

      if (sessionId && serialNumber) {
        await deps.sessionManager.leaveRoom({
          sessionId,
          serialNumber,
          connectionId,
        });
      }

      logger.info("socket disconnected", {
        id: socket.id,
        reason,
        sessionId,
        serialNumber,
      });
    } catch (e) {
      logger.warn("disconnect cleanup failed", { id: socket.id, err: String(e) });
    }
  });
}
