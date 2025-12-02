const { io } = require("socket.io-client");
const { spawn } = require("child_process");
const path = require("path");

const createPlainTransport = require('../mediaSoupFunctions/createPlainTransport')
const createProducerTransport = require("../mediaSoupFunctions/createProducerTransport")
const closeProducerTransport = require("../mediaSoupFunctions/closeProducerTransport")
const closePlainTransport = require("../mediaSoupFunctions/closePlainTransport")

class Session{
    constructor(id, name, creator, startDateTime, endDateTime, files, room){
        this.id = id,
        this.name = name,
        this.creator = creator,
        this.startDateTime = new Date(startDateTime),
        this.endDateTime = new Date(endDateTime),
        this.files = files, // esperado uma string com os arquivos a rep: 'files [filepath]'
        this.socket = null,
        this.ffmpeg = null,
        this.status = "pending" // pending | running | finished | cancelled
        this.room = room
        this.index = 0
        this.producer = null;
        this.plainTransportParams = null;
        this.current = null;
    }

    connectToServer(serverUrl){
        if(this.socket) return;

        this.socket = io(serverUrl, {
            transports: ["websocket"],
            reconnection: true,
        });

        this.socket.on("connect", () => {
            console.log(`[Session ${this.id}] connected to ${serverUrl}!`);
        });

        this.socket.on("disconnect", () => {
            console.log(`[Session ${this.id}] disconnected from ${serverUrl}`);
        });
    }

    async start(){
        if(!this.socket || this.status !== "pending") return;

        this.status = "running";

        console.log("[session]: calling joinroom");
        const joinRoomResp = await this.socket.emitWithAck('joinRoom', {user: this.creator, room: this.room});
        console.log("joinRoomResp: ", joinRoomResp);

        console.log("this files: ", this.files);
        await this._playFile(this.files[this.index]);
    }

    async _playFile(file){
        // fecha os producers abertos
        if(this.producer){
            await closeProducerTransport(this.socket);
            this.producer = null;
        }
        if(this.plainTransportParams){
            await closePlainTransport(this.socket);
            this.plainTransportParams = null;
        }

        console.log("Reproduzindo: ", file);
        
        this.plainTransportParams = await createPlainTransport(this.socket, this.room);
        console.log("PlainTransport created!");

        const { video_ip, video_port, video_rtcpPort, audio_ip, audio_port, audio_rtcpPort } = this.plainTransportParams;

        console.log("v-port: ", video_port);
        console.log("a-port: ", audio_port);

        const args = [
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

            // VIDEO
            "-map", "0:v:0?",
            "-c:v", "libvpx",
            "-b:v", "1000k",
            "-deadline", "realtime",
            "-cpu-used", "4",
            "-pix_fmt", "yuv420p",
            "-payload_type", "102",
            "-ssrc", "22222222",

            "-f", "tee",
            `[select=a:f=rtp:ssrc=11111111:payload_type=101]rtp://${audio_ip}:${audio_port}?rtcpport=${audio_rtcpPort}|` +
            `[select=v:f=rtp:ssrc=22222222:payload_type=102]rtp://${video_ip}:${video_port}?rtcpport=${video_rtcpPort}`
        ];

        this.current = spawn("ffmpeg", args);

        this.current.stderr.on("data", d => console.log("[ffmpeg]: ", d.toString()));
        this.current.on("exit", async () => {
            console.log("Ffmpeg terminoou de rep: ", file);
            await this._next();
        });

        setTimeout(async () => {
            if(!this.producer){
                this.producer = await createProducerTransport(this.socket);
                console.log("ProducerTransport created!", this.producer);
            }
        }, 1000);
    }

    async _next(){
        this.index++;
        if(this.index >= this.files.length){
            console.log("Playlist terminou!!");
            return;
        }

        await this._playFile(this.files[this.index]);
    }

    stop(){
        if(this.current){
            this.current.kill("SIGKILL");
        }
    }

    async cancel(){ // adicionar close() dos producers e transport's
        if(this.ffmpeg && this.status === "running"){
            this.ffmpeg.kill("SIGINT");
            console.log(`[Session ${this.id}] Ffmpeg finalizado!`);
        }

        this.status = "cancelled";
        if(this.socket){
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

module.exports = Session;