import type { Server as HttpServer } from "http";
import { Server as IOServer } from "socket.io";
import { env } from "../config/env.js";

export function createSocketServer(server: HttpServer) {
  const io = new IOServer(server, {
    cors: {
      origin: env.corsOrigin === "*" ? true : env.corsOrigin,
      credentials: true
    }
  });

  return io;
}
