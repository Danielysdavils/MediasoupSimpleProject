const { spawn } = require("child_process");

/**
 * Controla a reprodução de arquivos por ffmpeg:
 *  - Start() - inicia transmissão rtp
 *  - Stop() - para transmissão rtp
 */
class FFmpegService{
    constructor(){
        this.process = null;
    }

    start(file, rtpParams){
        return new Promise((resolve, reject) => {
            console.log("[FFmpegService]: FFmpeg vai reproduzir file: ", file);
            
            const { audio, video } = rtpParams;

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
                "-ssrc", "11111111", // (*) conferir se há conflito em sim

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
                `[select=a:f=rtp:ssrc=11111111:payload_type=101]rtp://${audio.ip}:${audio.port}?rtcpport=${audio.rtcpPort}|` +
                `[select=v:f=rtp:ssrc=22222222:payload_type=102]rtp://${video.ip}:${video.port}?rtcpport=${video.rtcpPort}`
            ];

            this.process = spawn("ffmpeg", args);

            this.process.stderr.on("data", d => {
                console.log("[ffmpeg]: ", d.toString());
            });

            this.process.on("error", reject);

            this.process.on("exit", () => {
                console.log("[FFmpegService]: FFmpeg terminoou de reproduzir file ", file);
                resolve();
            });
        });
    }

    stop(){
        if(this.process){
            this.process.kill("SIGKILL");
            this.process = null;
        }
    }
}

module.exports = FFmpegService;
