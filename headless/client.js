const { io } = require("socket.io-client") 
const { spawn } = require("child_process")
const path = require("path")

const createPlainTransport = require('./mediaSoupFunctions/createPlainTransport')
const createProducerTransport = require("./mediaSoupFunctions/createProducerTransport")

// este usuário será substituido com usuário que criou a sessão. Dado obtidos da Api
const user = 'server_teste'; 
// este nome da sala será subst com um id da Api também (*) pode ser id da sessão aleat (*) precisa ser identificador único
const room = 'room_teste'; // precisa ser único!!!

const videoPath = path.resolve(__dirname, "video", "video1.mp4")

// transport's
let plainTransportParams = null;

const socket = io(`http://localhost:3031`, {
    transports: ["websocket"],
    reconnection: true,
});

socket.on("connect", async () => {
    console.log("Connected to server socket!");

    // primeiro procuro rtpcapabilities para device
    const joinRoomResp = await socket.emitWithAck('joinRoom', {user, room});
    console.log("joinRoomResp: ", joinRoomResp);

    // crio o plainTransport
    plainTransportParams = await createPlainTransport(socket, room);
    console.log("PlainTransport created!");

    const videoPlainTransportParams = plainTransportParams.videoPlainTransportParams;
    const audioPlainTransportParams = plainTransportParams.audioPlainTransportParams;

    const video_ip = videoPlainTransportParams.ip;
    const video_port = videoPlainTransportParams.port;
    const video_rtcpPort = videoPlainTransportParams.rtcpPort;

    const audio_ip = audioPlainTransportParams.ip;
    const audio_port = audioPlainTransportParams.port;
    const audio_rtcpPort = audioPlainTransportParams.rtcpPort;

    const ffmpegArgs = [
        '-re',
        '-v', 'info',
        '-i', videoPath,

        '-map', '0:a:0',
        '-acodec', 'libopus',
        '-ab', '128k',
        '-ac', '2',
        '-ar', '48000',
        '-payload_type', '101',
        '-ssrc', '11111111',

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

    const ffmpeg = spawn("ffmpeg", ffmpegArgs);
    ffmpeg.stdout.on("data", (data) => {
        console.log(`stdout: ${data}`);
    });

    ffmpeg.stderr.on("data", (data) => {
        console.error(`stderr: ${data}`)
    });

    ffmpeg.on("close", (code) => {
        console.log(`Ffmpeg exited with code ${code}`)
    });

    setTimeout(async () => {
        const producer = await createProducerTransport(socket);
        console.log(producer);
    }, 1000);
});





