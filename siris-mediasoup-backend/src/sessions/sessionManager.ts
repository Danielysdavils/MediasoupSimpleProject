// src/sessions/SessionManager.ts
import { logger } from "../infra/logger.js";
import { WorkerPool } from "../mediasoup/workerPool.js";
import { mediaSoupConfig } from "../config/mediaSoup.js";
import { Session, type TransportDirection } from "./session.js";

type MsRouter = any;
type MsWorker = any;

export class SessionManager {
  private sessions = new Map<string, Session>();

  constructor(private readonly workerPool: WorkerPool) {}

  has(sessionId: string) {
    return this.sessions.has(sessionId);
  }

  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get or create session router.
   * This is the moment we pick the least loaded worker.
   */
  async getOrCreate(sessionId: string): Promise<Session> {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;

    const worker: MsWorker = await this.workerPool.getLeastLoadedWorker();

    const router: MsRouter = await worker.createRouter({
      mediaCodecs: mediaSoupConfig.routerMediaCodecs,
    });

    const session = new Session({
      id: sessionId,
      router,
      workerPid: worker.pid,
    });

    this.sessions.set(sessionId, session);

    logger.info("session created", { sessionId, workerPid: worker.pid });

    return session;
  }

  private toTransportParams(transport: any) {
    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  private toPlainTransportParams(transport: any){
    return {
      id: transport.id,
      ip: transport.tuple.localIp,
      port: transport.tuple.localPort,
      rtcpPort: transport.rtcpTuple.localPort
    }
  }

  /**
   * Create a WebRtcTransport and store it in Session by serialNumber (send/recv).
   * Protection:
   * - if transport already exists and is open -> throw
   * - if closed/zombie exists -> sanitize and create
   */
  async createWebRtcTransport(
    sessionId: string,
    serialNumber: string,
    direction: TransportDirection
  ) {
    const session = await this.getOrCreate(sessionId);

    const transport = await session.router.createWebRtcTransport({
      ...mediaSoupConfig.webRtcTransport,
    });

    if (mediaSoupConfig.webRtcTransport.maxIncomingBitrate) {
      try {
        await transport.setMaxIncomingBitrate(mediaSoupConfig.webRtcTransport.maxIncomingBitrate);
      } catch {}
    }

    session.setTransport(serialNumber, direction, transport);

    return transport;
  }

  async createPlainTransport(
    sessionId: string,
    serialNumber: string,
    purpose: "audio" | "video"
  ){
    const session = await this.getOrCreate(sessionId);

    const transport = await session.router.createPlainTransport({
      listenIp: mediaSoupConfig.webRtcTransport.listenIp,
      rtcpMux: false,
      comedia: true,
    });

    session.setPlainTransport(serialNumber, purpose, transport);
    return transport;
  }

  /**
   * JOIN policy (as discussed):
   * - serial required
   * - sanitize zombies
   * - create BOTH transports on join (send + recv)
   * Returns everything client needs to start:
   * - router rtpCapabilities
   * - send + recv transport params
   */

  async joinRoom(args: { sessionId: string; serialNumber: string; }) {
    const { sessionId, serialNumber } = args;

    if (!serialNumber) throw new Error("MISSING_SERIAL");
    if (!sessionId) throw new Error("MISSING_SESSION_ID");

    const session = await this.getOrCreate(sessionId);

    // proteção (não entra 2x)
    //session.assertCanJoin(serialNumber);

    // ✅ HARD RESET: se existir qualquer coisa do serial, fecha tudo e limpa
    await session.closePeer(serialNumber);

    const sendCreated = await this.createWebRtcTransport(sessionId, serialNumber, "send");
    const recvCreated = await this.createWebRtcTransport(sessionId, serialNumber, "recv");


    //console.log(sendCreated);
    //console.log(recvCreated);
    session.markJoined(serialNumber);

    logger.info("peer joined", {
      sessionId,
      serialNumber,
      workerPid: session.workerPid,
    });

    return {
      rtpCapabilities: session.router.rtpCapabilities,
      sendTransport: this.toTransportParams(sendCreated),
      recvTransport: this.toTransportParams(recvCreated),
      pausedProducers: Object.fromEntries(session.pausedProducers),
    };
  }

  async joinPlainRoom(args: { sessionId: string; serialNumber: string }){
    const { sessionId, serialNumber } = args;

    if(!serialNumber) throw new Error("MISSING_SERIAL");
    if(!sessionId) throw new Error("MISSING_SESSION_ID");

    const session = await this.getOrCreate(sessionId);

    await session.closePeer(serialNumber);

    const AplainCreated = await this.createPlainTransport(sessionId, serialNumber, "audio");
    const VplainCreated = await this.createPlainTransport(sessionId, serialNumber, "video");

    session.markJoined(serialNumber);
    logger.info("peer joined", {
      sessionId,
      serialNumber,
      workerPid: session.workerPid,
    });

    return {
      AudioPlainTransport: this.toPlainTransportParams(AplainCreated),
      VideoPlainTransport: this.toPlainTransportParams(VplainCreated)
    }
  }

  /**
   * Leave / disconnect cleanup:
   * - only if connectionId matches the active serial connection
   * - close peer transports
   */
  async leaveRoom(args: { sessionId: string; serialNumber: string; connectionId: string }) {
    const { sessionId, serialNumber, connectionId } = args;
    const session = this.sessions.get(sessionId);
    if (!session) return;

    await session.closePeer(serialNumber);
    session.markLeft(serialNumber);

    logger.info("peer left", { sessionId, serialNumber, connectionId });
  }

  /**
   * Optional: close and remove session (call when room is empty later)
   */
  close(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      session.close();
    } catch {}

    this.sessions.delete(sessionId);

    logger.info("session closed", { sessionId });
  }

  /**
   * Debug
   */
  list() {
    return Array.from(this.sessions.values()).map((s) => s.toListItem());
  }
}
