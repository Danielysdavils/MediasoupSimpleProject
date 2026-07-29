const { spawn } = require("child_process");
const path = require("path")
const fs = require("fs")
const os = require ("os")
const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";

/**
 * Controla a reprodução de arquivos por ffmpeg:
 *  - Start() - inicia transmissão rtp
 *  - Stop() - para transmissão rtp
*/


class FFmpegService{
    constructor(){
        this.process = null;
        this.stopping = false;
    }

    start(file, rtpParams, playbackMode){
        if(this.process){
            return Promise.reject(
                new Error("[FfmpegService]: Ffmpeg process already running")
            );
        }

        const mode = this._normalizePlaybackMode(playbackMode);

        console.log("[FfmpegService]: Ffmpef vai reproduzir file: ", file);
        console.log("[FfmpegService]: playbackMode: ", mode);

        const args = mode === "COPY_PREPARED"
            ? this._buildCopyPreparedArgs(file, rtpParams)
            : this._buildRealTimeTranscodeArgs(file, rtpParams);

        return this._runProcess(file, args);
    }

    async startPlaylist(files, rtpParams) {
        if (this.process) {
            throw new Error("[FfmpegService]: Ffmpeg process already running");
        }

        const listPath = this._createConcatList(files);
        const args = this._buildCopyPreparedPlayListArgs(listPath, rtpParams);

        return this._runProcess(listPath, args);
    }

    stop(){
        if (!this.process) return;

        this.stopping = true;

        try {
            this.process.kill("SIGTERM");

            const child = this.process;

            setTimeout(() => {
                if (child && !child.killed) {
                    child.kill("SIGKILL");
                }
            }, 3000);
        } catch (err) {
            console.log("[FFmpegService]: error stopping ffmpeg:", err);
        }
    }

    _runProcess(file, args){
        return new Promise((resolve, reject) => {
            this.stopping = false;

            console.log(`[FFmpegService]: usando FFmpeg em: ${ffmpegPath}`);

            this.process = spawn(ffmpegPath, args, {
                stdio: ["ignore", "ignore", "pipe"]
            });

            let settled = false;

            const finish = (err, result) => {
                if (settled) return;
                settled = true;

                this.process = null;

                if (err) reject(err);
                else resolve(result);
            };

            this.process.stderr.on("data", d => {
                console.log("[ffmpeg]:", d.toString());
            });

            this.process.on("error", err => {
                finish(err);
            });

            this.process.on("close", (code, signal) => {
                console.log(
                    `[FFmpegService]: FFmpeg terminou file=${file}, code=${code}, signal=${signal}`
                );

                if (this.stopping) {
                    finish(null, {
                        stopped: true,
                        code,
                        signal
                    });
                    return;
                }

                if (code === 0) {
                    finish(null, {
                        stopped: false,
                        code,
                        signal
                    });
                    return;
                }

                finish(
                    new Error(
                        `[FFmpegService]: FFmpeg failed. code=${code}, signal=${signal}, file=${file}`
                    )
                );
            });
        });
    }

    _buildCopyPreparedArgs(file, rtpParams) {
        const { audio, video } = rtpParams;

        const audioSsrc = "11111111";
        const videoSsrc = "22222222";

        return [
            "-hide_banner",
            "-loglevel", "info",

            "-re",
            "-fflags", "+genpts",
            "-i", file,

            "-map", "0:1",
            "-map", "0:0",

            "-c", "copy",

            "-flush_packets", "1",

            "-f", "tee",
            `[select=a:f=rtp:ssrc=${audioSsrc}:payload_type=101]rtp://${audio.ip}:${audio.port}?rtcpport=${audio.rtcpPort}&pkt_size=1200|` +
            `[select=v:f=rtp:ssrc=${videoSsrc}:payload_type=102]rtp://${video.ip}:${video.port}?rtcpport=${video.rtcpPort}&pkt_size=1200`
        ];
    }

    _buildCopyPreparedPlayListArgs(listPath, rtpParams){
        const { audio, video } = rtpParams;

        const audioSsrc = "11111111";
        const videoSsrc = "22222222";

        return [
            "-hide_banner",
            "-loglevel", "info",

            "-re",
            "-fflags", "+genpts",

            "-f", "concat",
            "-safe", "0",
            "-i", listPath,

            "-map", "0:a:0?",
            "-map", "0:v:0?",

            "-c", "copy",

            "-flush_packets", "1",

            "-f", "tee",
            `[select=a:f=rtp:ssrc=${audioSsrc}:payload_type=101]rtp://${audio.ip}:${audio.port}?rtcpport=${audio.rtcpPort}&pkt_size=1200|` +
            `[select=v:f=rtp:ssrc=${videoSsrc}:payload_type=102]rtp://${video.ip}:${video.port}?rtcpport=${video.rtcpPort}&pkt_size=1200`
        ];
    }

    _buildRealTimeTranscodeArgs(file, rtpParams){
        const { audio, video } = rtpParams;

        const audioSsrc = "11111111";
        const videoSsrc = "22222222";

        return [
            "-loglevel", "info",
            // "-report",

            "-re",
            "-fflags", "+genpts",
            "-i", file,

            // AUDIO
            "-map", "0:a:0?",
            "-c:a", "libopus",
            "-b:a", "96k",
            "-ar", "48000",
            "-ac", "2",

            // melhora sincronização do áudio
            "-af", "aresample=async=1000:first_pts=0",

            // VIDEO
            "-map", "0:v:0?",
            "-c:v", "libvpx",
            "-b:v", "900k",
            "-maxrate", "900k",
            "-bufsize", "1800k",

            "-deadline", "realtime",
            "-cpu-used", "8",
            "-threads", "4",
            "-row-mt", "1",
            "-lag-in-frames", "0",

            "-pix_fmt", "yuv420p",

            // força cadência estável
            "-vf", "fps=30,scale=1280:-2",
            "-fps_mode", "cfr",

            // keyframes previsíveis
            "-g", "30",
            "-keyint_min", "30",
            "-sc_threshold", "0",

            "-flush_packets", "1",

            "-f", "tee",
            `[select=a:f=rtp:ssrc=${audioSsrc}:payload_type=101]rtp://${audio.ip}:${audio.port}?rtcpport=${audio.rtcpPort}&pkt_size=1200|` +
            `[select=v:f=rtp:ssrc=${videoSsrc}:payload_type=102]rtp://${video.ip}:${video.port}?rtcpport=${video.rtcpPort}&pkt_size=1200`
        ];
    }

    _createConcatList(files) {
        const listPath = path.join(os.tmpdir(), `playlist-${crypto.randomUUID()}.ffconcat`);

        const escapePath = (filePath) => {
            let resolved = path.resolve(filePath);

            if (os.platform() === "win32") {
                resolved = resolved.replace(/\\/g, "/");
            }

            return resolved.replace(/'/g, "'\\''");
        };

        const content = [
            "ffconcat version 1.0",
            ...files.map(file => `file '${escapePath(file.path)}'`)
        ].join("\n");

        fs.writeFileSync(listPath, content);

        return listPath;
    }

    _normalizePlaybackMode(playbackMode) {
        if (
            playbackMode === "COPY_PREPARED" ||
            playbackMode === 1 ||
            playbackMode === "1"
        ) {
            return "COPY_PREPARED";
        }

        if (
            playbackMode === "TRANSCODE_REALTIME" ||
            playbackMode === 2 ||
            playbackMode === "2"
        ) {
            return "TRANSCODE_REALTIME";
        }

        console.log(
            `[FFmpegService]: playbackMode inválido ou indefinido: ${playbackMode}. Usando TRANSCODE_REALTIME.`
        );

        return "TRANSCODE_REALTIME";
    }
}

module.exports = FFmpegService;
