const { io } = require("socket.io-client");
const { spawn } = require("child_process");
const path = require("path");

const createProducerTransport = require("../mediaSoupFunctions/createProducerTransport")
const closeProducerTransport = require("../mediaSoupFunctions/closeProducerTransport")
const closePlainTransport = require("../mediaSoupFunctions/closePlainTransport")
const closeRoom = require("../mediaSoupFunctions/closeRoom")


class Session{
    constructor(id, name, creator, startDateTime, endDateTime, files, room){
        this.id = id,
        this.name = name,
        this.creator = creator,
        this.startDateTime = new Date(startDateTime),
        this.endDateTime = new Date(endDateTime),
        this.files = files, // esperado uma string com os arquivos a rep: 'files [filepath]'
        this.socket = null,
        this.status = "pending" // pending | running | finished | cancelled
        this.room = room
        this.index = 0
        this.producer = null;
        this.AudioplainTransportParams = null;
        this.VideoPlainTransportParams = null;
        this.current = null; // ffmpeg current process
        this.endTimer = null;
    }

    connectToServer(serverUrl){
        console.log(`connecting to ${serverUrl}`);
        if(this.socket) return;

        console.log("creating?")
        this.socket = io(serverUrl, {
            //path: "/signaling/socket.io/",
            transports: ["websocket"],
            rejectUnauthorized: false,
            //secure: true,
            //reconnection: true,
            //reconnectionAttempts: Infinity,
            //reconnectionDelayMax: 2000,
        });

        this.socket.on("connect", () => {
            console.log(`[Session ${this.id}] connected to ${serverUrl}!`);
        });

        this.socket.on("disconnect", () => {
            console.log(`[Session ${this.id}] disconnected from ${serverUrl}`);
        });

        this.socket.on("connect_error", (err) => {
            console.log(`[Session ${this.id}] error connection: ${err}`);
        })
    }

    async start(){
        if(!this.socket || this.status !== "pending") return;

        this.status = "running";

        console.log("[session]: calling joinroom");
        const joinRoomResp = await this.socket.emitWithAck('session:joinPlain', {
            sessionId: this.room, 
            serialNumber: this.creator
        });

        console.log("joinRoomResp: ", joinRoomResp);
        this.AudioplainTransportParams = joinRoomResp.AudioPlainTransport;
        this.VideoPlainTransportParams = joinRoomResp.VideoPlainTransport;

        this._scheduleEnd();

        console.log(this.files);

        await this._playFile(this.files[this.index]);
    }

    async _playFile(file){
        console.log("[Session] Reproduzindo: ", file);
        
        if(this.AudioplainTransportParams || this.VideoPlainTransportParams){
            console.log("init closing transports!");
            await closePlainTransport(this.socket);
            this.AudioplainTransportParams = null;
            this.VideoPlainTransportParams = null;
            console.log("closing transports!");
        }

        console.log("init join");
        const joinRoomResp = await this.socket.emitWithAck('session:joinPlain', {
            sessionId: this.room, 
            serialNumber: this.creator
        });

        console.log("joinRoomResp: ", joinRoomResp);
        this.AudioplainTransportParams = joinRoomResp.AudioPlainTransport;
        this.VideoPlainTransportParams = joinRoomResp.VideoPlainTransport;        

        // fecha os producers abertos
        if(this.producer){
            console.log("closing older producer");
            await closeProducerTransport(this.socket);
            this.producer = null;
        }

        console.log("[Session] creating producers!");
        this.producer = await createProducerTransport(this.socket);

        const a_ip = this.AudioplainTransportParams?.ip;
        const a_port = this.AudioplainTransportParams?.port;
        const a_rtcpPort = this.AudioplainTransportParams?.rtcpPort;

        const v_ip = this.VideoPlainTransportParams?.ip;
        const v_port = this.VideoPlainTransportParams?.port;
        const v_rtcpPort = this.VideoPlainTransportParams?.rtcpPort;

        const args = [
            "-loglevel", "info",
            "-report",

            "-re",
            "-i", file,
            
            // AUDIO
            "-map", "0:a:0?",
            "-c:a", "libopus",
            "-b:a", "128k",
            "-ar", "48000",
            "-ac", "2",
            "-payload_type", "101",
            "-ssrc", "11111111",

            // melhora sincronização do áudio
            "-af", "aresample=async=1:first_pts=0",

            // VIDEO
            "-map", "0:v:0?",
            "-c:v", "libvpx",

            "-b:v", "1000k",
            "-deadline", "realtime",
            "-cpu-used", "4",
            "-pix_fmt", "yuv420p",
            "-payload_type", "102",
            "-ssrc", "22222222",

            "-vsync", "1",

            "-f", "tee",
            `[select=a:f=rtp:ssrc=11111111:payload_type=101]rtp://${a_ip}:${a_port}?rtcpport=${a_rtcpPort}|` +
            `[select=v:f=rtp:ssrc=22222222:payload_type=102]rtp://${v_ip}:${v_port}?rtcpport=${v_rtcpPort}`
        ];

        this.current = spawn("ffmpeg", args);

        this.current.stderr.on("data", d => console.log("[ffmpeg]: ", d.toString()));
        this.current.on("exit", async () => {
            console.log("[Session] FFmpeg terminoou de reproduzir file ", file);
            await this._next();
        });
    }

    _scheduleEnd(){
        if(this.endTimer){
            clearTimeout(this.endTimer);
            this.endTimer = null;
        }

        const now = new Date();
        const delay = this.endDateTime - now;

        if(delay <= 0){
            console.log("[Session] endDateTime já passou, finalizando agora");
            this._finish();
            return;
        }

        const MAX_TIMEOUT = 2 ** 31 - 1;

        if(delay > MAX_TIMEOUT){
            // agenda em blocos se for muito longe
            this.endTimer = setTimeout(() => this._scheduleEnd(), MAX_TIMEOUT);

        }else{
            this.endTimer = setTimeout(() => {
                console.log("[Session] endDateTime atingido, encerrando sessão");
                this._finish();
            }, delay);
        }
    }

    async _next(){
        if(this.status !== "running")
            return;

        this.index++;
        if(this.index >= this.files.length){
            console.log("Playlist terminou, aguardando endDateTime");
            this.status = "finished";
            //this._finish();
            return;
        }

        await this._playFile(this.files[this.index]);
    }

    async cancel(){ // adicionar close() dos producers e transport's
        if(this.current && this.status === "running"){
            this.status = "cancelled";
        }

        await this._finish();
    }

    async _finish(){
        if(this.current){
            this.current.kill("SIGINT");
            this.current = null;
        }

        if(this.producer){
            await closeProducerTransport(this.socket);
            this.producer = null;
        }

        if(this.plainTransportParams){
            await closePlainTransport(this.socket);
            this.plainTransportParams = null;
        }

        await closeRoom(this.socket);

        if(this.socket){
            this.socket.disconnect();
            this.socket = null;
        }

        console.log("Session finished! All data removed");
    }
}

module.exports = Session;