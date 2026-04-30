// src/socket/registerTransportFunctions.ts
import { logger } from "../infra/logger.js";
import type { SessionManager } from "../sessions/sessionManager.js";

type SocketAny = any;

export function registerTransportFunctions(
  socket: SocketAny,
  deps: { sessionManager: SessionManager }
) {
  if ((socket as any).__transportHandlersRegistered) return;
  (socket as any).__transportHandlersRegistered = true;

  function getSessionAndSerial() {
    const sessionId = String(socket.data?.sessionId || "").trim();
    const serialNumber = String(socket.data?.serialNumber || "").trim();
    if (!sessionId) throw new Error("MISSING_SESSION_ID");
    if (!serialNumber) throw new Error("MISSING_SERIAL");

    const session = deps.sessionManager.get(sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");

    return { sessionId, serialNumber, session };
  }

  // 1) CONNECT TRANSPORT (send/recv)
  socket.on("transport:connect", async (payload: any, ack?: Function) => {
    try {
      const { session, sessionId, serialNumber } = getSessionAndSerial();

      const direction = String(payload?.direction || "").trim(); // "send" | "recv"
      const dtlsParameters = payload?.dtlsParameters;
      if (direction !== "send" && direction !== "recv") throw new Error("INVALID_DIRECTION");
      if (!dtlsParameters) throw new Error("MISSING_DTLS");

      const transport = session.getTransportOrThrow(serialNumber, direction as any);

      await transport.connect({ dtlsParameters });

      ack?.({ ok: true });

      logger.info("transport connected", { sessionId, serialNumber, direction });
    } catch (e: any) {
      const code = String(e?.message || "TRANSPORT_CONNECT_FAILED");
      ack?.({ ok: false, code });
    }
  });

  // transport comedia true não precisa connect
  socket.on("plain:producer:start", async (payload: any, ack?: Function) => {
    try{
      const { session, sessionId, serialNumber } = getSessionAndSerial();
      
      const kind = payload?.kind; // "audio" | "video"
      const rtpParameters = payload?.rtpParameters;
      const purpose = payload?.purpose;
      
      const appData = payload?.appData || {};

      if (!kind || !rtpParameters) throw new Error("MISSING_PRODUCE_PARAMS");

      const transport = session.getPlainTransportOrThrow(serialNumber, purpose);

      const producer = await transport.produce({
        kind,
        rtpParameters,
        appData: { ...appData, serialNumber },
      });

      session.addProducer(serialNumber, producer);

      ack?.({ ok: true, producerId: producer.id });

      logger.info("producer started", { sessionId, serialNumber, kind, producerId: producer.id, source: appData.source });
    }catch(e: any){
      const code = String(e?.message || "TRANSPORT PRODUCER_FAILED");
      ack?.({ ok: false, code });
    }
  });


  socket.on("plain:transport:close", async (_payload: any, ack?:Function) => {
    try{
      console.log("aqui??");
      const { session, serialNumber } = getSessionAndSerial();
      session.closeTransportsByPeer(serialNumber);
      ack?.({ ok: true });

    }catch(e:any){
      const code = String(e?.message || "CLOSING PLAIN TRANSPORT FAILED");
      ack?.({ ok: false, code });
    }
  });

  // 2) START PRODUCE (creates Producer on send transport)
  socket.on("producer:start", async (payload: any, ack?: Function) => {
    try {
      const { session, sessionId, serialNumber } = getSessionAndSerial();

      const kind = payload?.kind; // "audio" | "video"
      const rtpParameters = payload?.rtpParameters;
      const appData = payload?.appData || {};

      if (!kind || !rtpParameters) throw new Error("MISSING_PRODUCE_PARAMS");

      const sendTransport = session.getTransportOrThrow(serialNumber, "send");

      const producer = await sendTransport.produce({
        kind,
        rtpParameters,
        appData: { ...appData, serialNumber },
      });

      session.addProducer(serialNumber, producer);

      ack?.({ ok: true, producerId: producer.id });

      logger.info("producer started", { sessionId, serialNumber, kind, producerId: producer.id, source: appData.source });
    } catch (e: any) {
      const code = String(e?.message || "PRODUCE_FAILED");
      ack?.({ ok: false, code });
    }
  });

  // (opcional) listar producers disponíveis
  socket.on("producer:list", async (_payload: any, ack?: Function) => {
    try {
      const { session, serialNumber } = getSessionAndSerial();
      const ids = session.listProducers(); // exclude self
      ack?.({ ok: true, producers: ids });
    } catch (e: any) {
      ack?.({ ok: false, code: String(e?.message || "LIST_FAILED") });
    }
  });

  socket.on("producer:pause", async (payload: any, ack?: Function) => {
    try{
      if(!payload?.producerId) throw new Error("MISSING_PRODUCER_ID");
      
      const { session } = getSessionAndSerial();
      await session.pauseProducerById(payload.producerId);
      
      socket.to(session.id).emit("producer:state", {
        producerId: payload.producerId,
        paused: true
      });

      ack?.({ ok: true });

    }catch(e: any){
      ack?.({ ok: false, code: String(e?.message || "PAUSE_FAILED") });
    }
  });

  socket.on("producer:resume", async (payload: any, ack?: Function) => {
    try{
      if(!payload?.producerId) throw new Error("MISSING_PRODUCER_ID");
      
      const { session } = getSessionAndSerial();
      await session.resumeProducerById(payload?.producerId);
      
      socket.to(session.id).emit("producer:state", {
        producerId: payload.producerId,
        paused: false
      });

      ack?.({ ok: true });
      
    }catch(e: any){
      ack?.({ ok: false, code: String(e?.message || "RESUME_FAILED") });
    }
  });


  socket.on("producer:close", async (_payload: any, ack?: Function) => {
    try{
      console.log("calling closing producer!");

      const { session, serialNumber } = getSessionAndSerial();
      session.closeProducerByPeer(serialNumber);
      ack?.({ ok: true });

    }catch(e: any){
      console.log(String(e?.message || "ERROr"));
      ack?.({ ok: false, code: String(e?.message || "RESUME_FAILED") });
    }
  });


  // 3) CONSUME / SYNC
  // client envia rtpCapabilities e (opcional) producerIds que ele quer consumir
  socket.on("consumer:sync", async (payload: any, ack?: Function) => {
    try {
      const { session, sessionId, serialNumber } = getSessionAndSerial();

      const rtpCapabilities = payload?.rtpCapabilities;
      if (!rtpCapabilities) throw new Error("MISSING_RTP_CAPABILITIES");

      const recvTransport = session.getTransportOrThrow(serialNumber, "recv");

      // se o client não mandar lista, consumimos TODOS (menos os dele)
      const requestedIds: string[] | undefined = Array.isArray(payload?.producerIds)
        ? payload.producerIds.map((x: any) => String(x))
        : undefined;

      const producerIds = requestedIds?.length
        ? requestedIds
        : session.listProducerIds(serialNumber);

      const consumersParams: any[] = [];

      for (const producerId of producerIds) {
        const producer = session.getProducer(producerId);
        if (!producer) continue;

        // checar se o client pode consumir
        const canConsume = session.router.canConsume({
          producerId,
          rtpCapabilities,
        });

        if (!canConsume) continue;

        const consumer = await recvTransport.consume({
          producerId,
          rtpCapabilities,
          // recomendado pra video conference
          paused: true,
        });

        session.addConsumer(serialNumber, consumer);

        consumersParams.push({
          id: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          type: consumer.type,
          producerPaused: consumer.producerPaused,
        });

        // (opcional agora) você pode guardar consumer pra cleanup depois
        consumer.on?.("transportclose", () => {
          try {
            consumer.close?.();
          } catch {}
        });
      }

      ack?.({ ok: true, consumersParams });

      logger.info("consumer sync", {
        sessionId,
        serialNumber,
        requested: producerIds.length,
        created: consumersParams.length,
      });
    } catch (e: any) {
      const code = String(e?.message || "CONSUME_FAILED");
      ack?.({ ok: false, code });
    }
  });

  // ✅ RESUME CONSUMER
  socket.on("consumer:resume", async (payload: any, ack?: Function) => {
    try {
      logger.info("consumer resume requested", { payload });
      const { serialNumber, session } = getSessionAndSerial();

      const consumerId = String(payload?.consumerId || "").trim();
      if (!consumerId) throw new Error("MISSING_CONSUMER_ID");

      const consumer = session.getConsumer(serialNumber, consumerId);
      if (!consumer) throw new Error("CONSUMER_NOT_FOUND");

     
      await consumer.resume();

      logger.info("consumer resume", {
        consumerId,
      });

      ack?.({ ok: true });
    } catch (e: any) {
      ack?.({ ok: false, code: String(e?.message || "RESUME_FAILED") });
    }
  });
}
