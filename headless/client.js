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

    const { ip, port, rtcpPort } = plainTransportParams;

    // crio os tracks do ffmpeg
    const ffmpegArgs = [
        "-re",
        "-i", videoPath,
        "-map", "0:v:0", "-c:v", "libx264", "-b:v", "1M", "-f", "rtp", `rtp://${ip}:${port}?rtcpport=${rtcpPort}`,
        "-map", "0:a:0", "-c:a", "aac", "-b:a", "128k", "-f", "rtp", `rtp://${ip}:${port}?rtcpport=${rtcpPort}`,
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

    const producer = await createProducerTransport(socket);
});





