const { io } = require("socket.io-client");
const { spawn } = require("child_process");

const createPlainTransport = require('./mediaSoupFunctions/createPlainTransport')
const createProducerTransport = require("./mediaSoupFunctions/createProducerTransport")

class Session{
    constructor(id, name, creator, startDateTime, endDateTime, files, room){
        this.id = id,
        this.name = name,
        this.creator = creator,
        this.startTime = new Date(startDateTime),
        this.endTime = new Date(endDateTime),
        this.files = files, // esperado uma string com os arquivos a rep: 'files [filepath]'
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
            '-re', '-v', 'info',
            '-f', 'concat', '-safe', '0', '-i', '-', // stdin com a lista de arquivos

            // Fallback para áudio ausente: gera mudo se não houver áudio
            '-f', 'lavfi', '-t', '0.1', '-i', 'anullsrc=r=48000:cl=stereo',

            // Seleciona: usa áudio do vídeo se existir, senão usa o anullsrc
            '-filter_complex',
            "[0:a]loudnorm=I=-16:TP=-1.5:LRA=11[a1];" + // normalização EBU R128
            "[1:a][a1]amerge=inputs=1[aout];" +          // combina fallback + áudio original
            "[0:v]scale=-2:720,format=yuv420p[vout]",   // redimensiona vídeo

            // Mapeia as saídas dos filtros
            '-map', '[aout]', 
            '-map', '[vout]',

            // audio codecs
            '-acodec', 'libopus', '-ab', '128k', '-ac', '2', '-ar', '48000',
            '-payload_type', '101', '-ssrc', '11111111',

            // video codecs
            '-c:v', 'libvpx', '-b:v', '1000k', '-deadline', 'realtime', 
            '-cpu-used', '4', '-pix_fmt', 'yuv420p', 
            '-payload_type', '102', '-ssrc', '22222222',

            // saída rtp (tee multiplexer)
            '-f', 'tee',
            `[select=a:f=rtp:ssrc=11111111:payload_type=101]rtp://${audio_ip}:${audio_port}?rtcpport=${audio_rtcpPort}|[select=v:f=rtp:ssrc=22222222:payload_type=102]rtp://${video_ip}:${video_port}?rtcpport=${video_rtcpPort}`
        ];

        this.ffmpeg = spawn("ffmpeg", ffmpegArgs);

        this.ffmpeg.stdin.write(this.files);
        this.ffmpeg.stdin.end();

        ffmpeg.stdout.on("data", (data) => {
            console.log(`stdout: ${data}`);
        });

        this.ffmpeg.stderr.on("data", (data) => {
            console.log(data.toString());
            console.error(`stderr: ${data}`);
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