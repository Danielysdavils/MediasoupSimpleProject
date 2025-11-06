const { io } = require("socket.io-client");
const { spawn } = require("child_process");

const createPlainTransport = require('./mediaSoupFunctions/createPlainTransport')
const createProducerTransport = require("./mediaSoupFunctions/createProducerTransport")

class Session{
    constructor({id, name, creator, startTime, endTime, files, room}){
        this.id = id,
        this.name = name,
        this.creator = creator,
        this.startTime = new Date(startTime),
        this.endTime = new Date(endTime),
        this.files = files, // esse é os files concat: .txt com os endereços finais dos arquivos
        this.socket = null,
        this.ffmpeg = null,
        this.status = "pending" // pending | running | finished | cancelled
        this.room = room
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

        thhis.socket.on("disconnect", () => {
            console.log(`[Session ${this.id}] disconnected from ${serverUrl}`);
        });
    }

    async startTransmission(){
        if(this.socket || this.status !== "pending") return;

        this.status = "running";

        // primeiro procuro rtpcapabilities para device
        const joinRoomResp = await socket.emitWithAck('joinRoom', {user: this.creator, room: this.room});
        console.log("joinRoomResp: ", joinRoomResp);

        // crio o plainTransport, importante usar 2 transport: 1a/1v
        plainTransportParams = await createPlainTransport(this.socket, this.room);
        console.log("PlainTransport created!");

        const { video_ip, video_port, video_rtcpPort, audio_ip, audio_port, audio_rtcpPort } = plainTransportParams;

        const ffmpegArgs = [
            '-re',
            '-v', 'info',
            '-i', this.files,

            // audio params
            '-map', '0:a:0',
            '-acodec', 'libopus',
            '-ab', '128k',
            '-ac', '2',
            '-ar', '48000',
            '-payload_type', '101',
            '-ssrc', '11111111',

            // video params
            '-map', '0:v:0',
            '-c:v', 'libvpx',
            '-b:v', '1000k',
            '-deadline', 'realtime',
            '-cpu-used', '4',
            '-pix_fmt', 'yuv420p',
            '-payload_type', '102',
            '-ssrc', '22222222',

            '-f', 'tee',
            `[select=a:f=rtp:ssrc=11111111:payload_type=101]rtp://${audio_ip}:${audio_port}?rtcpport=${audio_rtcpPort}|[select=v:f=rtp:ssrc=22222222:payload_type=102]rtp://${video_ip}:${video_port}?rtcpport=${video_rtcpPort}`
        ];

        this.ffmpeg = spawn("ffmpeg", ffmpegArgs);
        ffmpeg.stdout.on("data", (data) => {
            console.log(`stdout: ${data}`);
        });

        this.ffmpeg.stderr.on("data", (data) => {
            console.error(`stderr: ${data}`)
        });

        this.ffmpeg.on("close", (code) => {
            console.log(`Ffmpeg exited with code ${code}`);
            this.status = "finished";
        });

        this.ffmpeg.on("exit", (code) => {
            console.log(`Ffmpeg exited with code ${code} for session: ${this.id}`);
            this.status = "finished";
        });

        setTimeout(async () => {
            const producer = await createProducerTransport(this.socket);
            console.log(producer);
        }, 1000);
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