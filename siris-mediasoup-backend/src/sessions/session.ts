import type { PlainTransport } from "mediasoup/types";

// src/sessions/Session.ts
type MsRouter = any;
type MsTransport = any;
type MsProducer = any;
type MsConsumer = any;

export type TransportDirection = "send" | "recv";

export type TransportKind = "webrtc" | "plain";

type PeerTransports = {
  webrtc? : {
    send?: MsTransport;
    recv?: MsTransport;
  };
  plain? : {
    audio?: PlainTransport;
    video?: PlainTransport;
  }
  all: Map<string, MsTransport>;
};

export class Session {
  public readonly id: string;
  public readonly router: MsRouter;
  public readonly workerPid: number;
  public readonly createdAt: number;

  public readonly pausedProducers = new Map<string, boolean>();

  // ✅ proteção: serial conectado (não entra 2x)
  private readonly connectedSerials = new Set<string>();

  // ✅ transports por serial
  private readonly transportsBySerial = new Map<string, PeerTransports>();

  // ✅ producers globais da sessão (pra consumo)
  private readonly producers = new Map<string, MsProducer>(); // producerId -> producer
  private readonly producerOwner = new Map<string, string>(); // producerId -> serial

  // ✅ consumers por serial (para resume/cleanup)
  private readonly consumersBySerial = new Map<string, Map<string, MsConsumer>>(); // serial -> (consumerId -> consumer)

  constructor(args: { id: string; router: MsRouter; workerPid: number; createdAt?: number }) {
    this.id = args.id;
    this.router = args.router;
    this.workerPid = args.workerPid;
    this.createdAt = args.createdAt ?? Date.now();
  }

  // ---------------------------
  // Presence / protection
  // ---------------------------

  assertCanJoin(serial: string) {
    if (this.connectedSerials.has(serial)) {
      throw new Error("SERIAL_ALREADY_CONNECTED");
    }
  }

  markJoined(serial: string) {
    this.connectedSerials.add(serial);
  }

  markLeft(serial: string) {
    this.connectedSerials.delete(serial);
  }

  // ---------------------------
  // Transports store
  // ---------------------------

  private getOrCreatePeerTransports(serial: string): PeerTransports {
    let peer = this.transportsBySerial.get(serial);
    if (!peer) {
      peer = { all: new Map<string, MsTransport>() };
      this.transportsBySerial.set(serial, peer);
    }
    return peer;
  }

  // ✅ getter do transport já criado no join
  getTransportOrThrow(serial: string, direction: TransportDirection): MsTransport {
    const peer = this.transportsBySerial.get(serial);
    const t = direction === "send" ? peer?.webrtc?.send : peer?.webrtc?.recv;
    if (!t || t.closed) throw new Error(`MISSING_${direction.toUpperCase()}_TRANSPORT`);
    return t;
  }

  getPlainTransportOrThrow(serial: string, purpose: "audio" | "video"){
    const peer = this.transportsBySerial.get(serial);
    const t = peer?.plain?.[purpose];
    if(!t || t.closed) throw new Error("MISSING_PLAIN_TRANSPORT");
    return t;
  }

  setTransport(serial: string, direction: TransportDirection, transport: MsTransport) {
    const peer = this.getOrCreatePeerTransports(serial);
    peer.all.set(transport.id, transport);

    if(!peer.webrtc) peer.webrtc = {};
    
    if (direction === "send") peer.webrtc.send = transport;
    else peer.webrtc.recv = transport;
  }

  setPlainTransport(serial: string, purpose: "audio" | "video", transport: PlainTransport){
    const peer = this.getOrCreatePeerTransports(serial);

    if(!peer.plain) peer.plain = {};

    peer.plain[purpose] = transport;
    peer.all.set(transport.id, transport);
  }

  // ✅ producers helpers
  addProducer(serial: string, producer: MsProducer) {
    this.producers.set(producer.id, producer);
    this.producerOwner.set(producer.id, serial);

    // cleanup automático
    producer.on?.("transportclose", () => {
      this.producers.delete(producer.id);
      this.producerOwner.delete(producer.id);
    });
    producer.on?.("close", () => {
      this.producers.delete(producer.id);
      this.producerOwner.delete(producer.id);
    });

    producer.on?.("pause", () => {
      console.log(`Producer ${producer.id} paused`);
    });

    producer.on?.("resume", () => {
      console.log(`Producer ${producer.id} resume`);
    });
  }

  getProducer(producerId: string): MsProducer | undefined {
    return this.producers.get(producerId);
  }

  listProducerIds(excludeSerial?: string) {
    const result: string[] = [];
    for (const [producerId, ownerSerial] of this.producerOwner.entries()) {
      if (excludeSerial && ownerSerial === excludeSerial) continue;

      result.push(producerId);
    }
    return result;
  }

  listProducers() {
    return [...this.producers.entries()].map(([producerId, producer]) => ({
      serialNumber: this.producerOwner.get(producerId),
      producerId,
      source: producer.appData?.source ?? null,
      kind: producer.kind,
    }));
  }

  async pauseProducerById(producerId: string) {
    const producer = this.producers.get(producerId);

    if (!producer)
      throw new Error(`pauseProducer: no producer with id ${producerId}`);

    if (producer.paused) return;

    await producer.pause();
    this.pausedProducers.set(producer.id, true);

    console.log(`Producer paused: ${producerId}`);
  }

  async resumeProducerById(producerId: string) {
    const producer = this.producers.get(producerId);

    if (!producer)
      throw new Error(`resumeProducer: no producer with id ${producerId}`);

    if (!producer.paused) return;

    await producer.resume();
    this.pausedProducers.set(producer.id, false);

    console.log(`Producer resumed: ${producerId}`);
  }

  // ✅ consumers
  private getOrCreateConsumerMap(serial: string) {
    let m = this.consumersBySerial.get(serial);
    if (!m) {
      m = new Map<string, MsConsumer>();
      this.consumersBySerial.set(serial, m);
    }
    return m;
  }

  addConsumer(serial: string, consumer: MsConsumer) {
    const map = this.getOrCreateConsumerMap(serial);
    map.set(consumer.id, consumer);

    const cleanup = () => {
      const m = this.consumersBySerial.get(serial);
      m?.delete(consumer.id);
      if (m && m.size === 0) this.consumersBySerial.delete(serial);
    };

    consumer.on?.("transportclose", cleanup);
    consumer.on?.("producerclose", cleanup);
    consumer.on?.("close", cleanup);
  }

  getConsumer(serial: string, consumerId: string): MsConsumer | undefined {
    return this.consumersBySerial.get(serial)?.get(consumerId);
  }

  /*
  * Fecha só o producer desse peer.
  * (!) Importante para o headless, que precisa re-criar producers a cada arquivo
  */
  closeProducerByPeer(serial: string){
    for (const [producerId, ownerSerial] of this.producerOwner.entries()){
      if (ownerSerial !== serial) continue;
      const p = this.producers.get(producerId);
      try{
        p?.close?.();
      }catch {}
      this.producers.delete(producerId);
      this.producerOwner.delete(producerId);
    }
  }

  /*
  * Fecha os transport do peer associado.
  * (!) Importante para o headlesss, que precisa re-criar transport a cada arquivo
  */
  closeTransportsByPeer(serial: string){
    const peer = this.transportsBySerial.get(serial);
    if (peer) {
      for (const t of peer.all.values()) {
        try {
          t.close?.();
        } catch {}
      }
      this.transportsBySerial.delete(serial);
    }
  }

  /**
   * Fecha tudo do peer (send/recv e quaisquer transports em "all"),
   * e remove do mapa.
   */
  async closePeer(serial: string) {
    // close consumers
    const consumerMap = this.consumersBySerial.get(serial);
    if (consumerMap) {
      for (const c of consumerMap.values()) {
        try {
          c.close?.();
        } catch {}
      }
      this.consumersBySerial.delete(serial);
    }

    // close producers owned by this serial
    this.closeProducerByPeer(serial);
    

    // close transports
    this.closeTransportsByPeer(serial);
  }

  close() {
    try {
      this.router?.close?.();
    } catch {}
  }

  toListItem() {
    return {
      id: this.id,
      workerPid: this.workerPid,
      createdAt: this.createdAt,
      peersActive: this.connectedSerials.size,
      peersWithTransports: this.transportsBySerial.size,
    };
  }
}
