import http from "http";
import https from "https";
import { env } from "./config/env.js";
import { createHttpApp } from "./infra/http.js";
import { createSocketServer } from "./infra/ws.js";
import { logger } from "./infra/logger.js";
import { WorkerPool } from "./mediasoup/workerPool.js";
import { SessionManager } from "./sessions/sessionManager.js";
import { registerConnectionFunctions } from "./signaling/registerConnectionFunctions.js";
import { registerSessionFunctions } from "./signaling/registerSessionFunctions.js";
import { registerTransportFunctions } from "./signaling/registerTransportFunctions.js";
import { registerDebugFunctions } from "./signaling/registerDebugFunctions.js";
import fs from "fs";

async function main() {
  const app = createHttpApp();

  const isProduction = process.env.NODE_ENV === "production";

  const server = isProduction
    ? http.createServer(app) // ✅ produção
    : https.createServer(
        // ✅ dev/build
        {
          key: fs.readFileSync("./siris.local+2-key.pem"),
          cert: fs.readFileSync("./siris.local+2.pem"),
        },
        app
      );
  const io = createSocketServer(server);

  const workerPool = await WorkerPool.create(env.numWorkers);
  logger.info("mediasoup workers ready", { count: env.numWorkers });

  const sessionManager = new SessionManager(workerPool);

  io.on("connection", (socket: any) => {
    logger.info("socket connected", { id: socket.id });
    registerConnectionFunctions(socket, { sessionManager });
    registerSessionFunctions(socket, { sessionManager });
    registerDebugFunctions(socket, { workerPool, sessionManager });
    registerTransportFunctions(socket, { sessionManager });
  });

  server.listen(env.port, () => {
    logger.info("server listeninggg", { port: env.port, protocol: isProduction ? "http" : "https" });
    logger.info("healthcheck", { url: `https://0.0.0.0:${env.port}/health` });
  });
}

main().catch((err) => {
  logger.error("fatal error", err);
  process.exit(1);
});
