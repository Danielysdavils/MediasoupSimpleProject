const { io } = require("socket.io-client");

/**
 * Responsável por toda a conexão com servidor mediasoup.
 *  Transport usados: plainTransport's.
 *  Producers usados: screenVideo e screenAudio
 */
class MediaSoupClient {
    constructor (serverUrl, sessionId, serialNumber){
        this.serverUrl = serverUrl;
        this.sessionId = sessionId;
        this.serialNumber = serialNumber;

        this.socket = null;
        
        this.audioTransport = null;
        this.videoTransport = null;
        this.producer = null;
    }

    /**
     * Connect with signaling mediasoup server
     * @returns 
     */
    async connect(){
        console.log(`[MediasoupClient] connecting to server ${this.serverUrl}`);

        if(this.socket) return;
        // (!) para deploy servidor deixar assim
        this.socket = io(this.serverUrl, {
            path: "/signaling2/socket.io/",
            transports: ["websocket"],
            secure: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelayMax: 2000,
        });

        // (!) para teste local deixar assim
        //  this.socket = io(this.serverUrl, {
        //       //path: "/signaling/socket.io/",
        //       transports: ["websocket"],
        //       rejectUnauthorized: false,
        //       //secure: true,
        //       //reconnection: true,
        //       //reconnectionAttempts: Infinity,
        //       //reconnectionDelayMax: 2000,
        //   });

        this.socket.on("connect", () => {
            console.log(`[Session ${this.sessionId}] connected to ${this.serverUrl}!`);
        });

        this.socket.on("disconnect", () => {
            console.log(`[Session ${this.sessionId}] disconnected from ${this.serverUrl}`);
        });

        this.socket.on("connect_error", (err) => {
            console.log(`[Session ${this.sessionId}] error connection: ${err}`);
        })
    }

    /*
    * Entra na sala e requisita plainTransport's (Audio/Video)
    */
    async join(){
        const resp = await this.socket.emitWithAck(`session:joinPlain`, {
            sessionId: this.sessionId, // room
            serialNumber: this.serialNumber // creator
        });

        this.audioTransport = resp.AudioPlainTransport;
        this.videoTransport = resp.VideoPlainTransport;

        return resp;
    }

    /**
     * Saí da sala criada pelo servidor - fecha transports e producers internos
     */
    async leave(){
        await this.socket.emitWithAck("session:left", `headless leave for session ${this.sessionId}`);
    }

    /*
    * Create audio and video producer with local transports
    */
    async createProducerTransport(){
        const rtpParametersVideo = {
            codecs: [{
                mimeType: "video/vp8",
                payloadType: 102,
                clockRate: 90000
            }],
            encodings: [{ ssrc: 22222222 }],
            //rtcp: { cname: "CNAME" },
        };

        const rtpParametersAudio = {
            codecs: [{
                mimeType: "audio/opus",
                payloadType: 101,
                clockRate: 48000,
                channels: 2,
            }],
            encodings: [{ ssrc: 11111111 }],
            //rtcp: { cname: "CNAME" },
        };

        try{
            const videoProducer = await this.socket.emitWithAck("plain:producer:start", {
                kind: "video",
                rtpParameters: rtpParametersVideo,
                appData: { source: "screenVideo" },
                purpose: "video"
            });

            const audioProducer = await this.socket.emitWithAck("plain:producer:start", {
                kind: "audio",
                rtpParameters: rtpParametersAudio,
                appData: { source: "screenAudio" },
                purpose: "audio"
            });

            this.producer = { audioProducer, videoProducer };
        }catch(e){
            throw new Error(e);
        }
    }

    /*
    * Close all producer's for peer
    */
    async closeProducerTransport(){
        try{
            if(!this.producer) return;
            await this.socket.emitWithAck("producer:close", {});
            this.producer = null;
        }catch(e){
            throw new Error(e);
        }
    }

    /**
     * Close all transport's for peer
     */
    async closeTransports(){
        try{
            if (!this.audioTransport && !this.videoTransport) return;

            await this.socket.emitWithAck("plain:transport:close", {})
            this.audioTransport = null;
            this.videoTransport = null;

        }catch(e){
            throw new Error(e);
        }
    }

    /**
     * Reset all mediasoup data
     */
    async resetPipeline(){
        try{
            await this.closeProducerTransport();
            await this.closeTransports();

            await this.join();
            await this.createProducerTransport();

        }catch(e){
            throw new Error(e);
        }
    }

    getRtpParams(){
        return{
            audio: this.audioTransport,
            video: this.videoTransport
        };
    }

    /**
     * Clean all data: mediasoup and singaling data
     */
    async cleanup(){
        await this.closeProducerTransport();
        await this.closeTransports();
        await this.leave();

        if(this.socket){
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

module.exports = MediaSoupClient;