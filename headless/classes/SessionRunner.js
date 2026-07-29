const MediaSoupClient = require("./MediaSoupClient");
const FFmpegService = require("./FFmpegService");
const TaskQueue = require("./TaskQueue");

/**
 * Gestiona a reprodução da sessão usando ffmpeg e injeta no servidor mediasoup
 */
class SessionRunner {
    constructor(session, serverUrl){
        this.session = session;

        // mediasoup client (injeção da transmissão ffmpeg)
        this.mediaSoup = new MediaSoupClient(
            serverUrl,
            session.id,
            session.creator
        );

        // ffmpeg service  (transmissão ffmpef)
        this.ffmpeg = new FFmpegService();

        // queue de ordem de processos async
        this.queue = new TaskQueue();

        this.cancelled = false;
        this.endTimer = null;
        this.cleanedUp = false;
    }

    async run(){
        try{
            console.log(`[Runner] starting session ${this.session.id}`);

            this.session.status = "running";

            // prioridade de execução primaria. 
            // antes de inicializar ffmpeg precisamos garantir conexão
            await this.queue.add(async () => {
                // conecta com servidor signaling
                await this.mediaSoup.connect();

                // agenda o fim da sessão (caso termine antes)
                this._scheduleEnd();
            });

            if(!this.cancelled && !this.session.isFinishedByTime()){
                await this.__playList(this.session.files);
            }

            // ======= para reprodução por arquivo ===========
            // inicia a reprodução de cada arquivo
            // while(!this.cancelled){
            //     if(this.session.isFinishedByTime()){
            //         console.log("[Runner] tempo da sessão acabou");
            //         break;
            //     }

            //     const file = this.session.files[this.session.index];
            //     if(!file){
            //         console.log("[Runner] playlist terminou, aguardando fim da sessão");

            //         // espera até o endDateTime
            //         await this._waitUntilEnd();
            //         break;
            //     }

            //     await this._playFile(file);

            //     this.session.index++;
            // }
            // ====================================================

            console.log(`[Runner] session finished`);
            //this.session.status = "finished";
        
        }catch(e){
            console.log(`[Runner] error `, e);

        }finally{
            await this.cleanup();
        }
    }

    /**
     * Garante reprodução de arquivo
     * @param {*} file 
     */
    async _playFile(file){
        return this.queue.add(async () => {
            if(this.cancelled) return;

            console.log(`[Runner] playing ${file}`);

            // limpa o estado do mediasoup (transport's e producers)
            await this.mediaSoup.resetPipeline();

            // audio e video params
            const rtpParams = this.mediaSoup.getRtpParams();

            // inicia a transmissão ffmpeg
            await this.ffmpeg.start(file.path, rtpParams, file.playbackMode);
        });
    }

    async __playList(files){
        return this.queue.add(async () => {
            if(this.cancelled) return;

            // em playlist chamamos só 1 vez
            await this.mediaSoup.resetPipeline();

            const rtpParams = this.mediaSoup.getRtpParams();

            await this.ffmpeg.startPlaylist(files, rtpParams);

            // caso termine antes, espera fim da sessão
            await this._waitUntilEnd();
        })
    }

    /**
     * Verifica tempo de fim da sessão
     * @returns 
     */
    _waitUntilEnd(){
        return new Promise((resolve) => {
            const check = () => {
                if(this.cancelled){
                    return resolve();
                }

                const now = new Date();
                if(now >= this.session.endDateTime){
                    return resolve();
                }

                setTimeout(check, 500); // polling leve
            };

            check();
        });
    }

    /**
     * Agenda fim da sessão
     * @returns 
     */
    _scheduleEnd(){
        const delay = this.session.endDateTime - new Date();

        if(delay <= 0){
            this.cancel();
            return;
        }

        this.endTimer = setTimeout(() => {
            console.log("[Runner] endDateTime atingido!");
            this.cancel(); // força a limpeza de tudo
        }, delay);
    }

    cancel(){
        if(this.cancelled) return;

        this.cancelled = true;

        console.log("[Runner] cancel");
        this.ffmpeg.stop(); // mata imediatamente
    }

    /**
     * Clean all data for ffmpeg and mediasoup
     */
    async cleanup(){
        return this.queue.add(async () => {
            if(this.cleanedUp) return;
            this.cleanedUp = true;

            console.log("[Runner] cleanup");

            this.ffmpeg.stop();

            await this.mediaSoup.cleanup();

            if(this.endTimer){
                clearTimeout(this.endTimer);
                this.endTimer = null;
            }

            this.session.status = this.cancelled ? "cancelled" : "finished";
        });
    }
}

module.exports = SessionRunner;