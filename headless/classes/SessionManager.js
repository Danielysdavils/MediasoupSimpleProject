const path = require("path")
const fs = require("fs")
const os = require ("os")

const Session = require("./Session");
const SessionQueue = require("./SessionQueue");
const SessionRunner = require("./SessionRunner");

class SessionManager{
    constructor(serverUrl){
        this.serverUrl = serverUrl;

        // controle de sessões enfileiradas - prestes a iniciar
        this.sessionsList = new SessionQueue();
        this.currentTimer = null;

        // controle de sessões rodando - em execução
        this.runningSessions = new Map();

        // controla a última versão recebida por sessão
        this.sessionVersions = new Map();
    }

    acceptVersion(sessionId, incomingVersion){
        const currentVersion = this.sessionVersions.get(sessionId) ?? 0;

        if(incomingVersion <= currentVersion){
            console.log(`[SessionManager] Evento antigo ignorado. session=${sessionId}, incoming=${incomingVersion}, current=${currentVersion}`);
            return false;
        }

        this.sessionVersions.set(sessionId, incomingVersion);
        return true;
    }

    // adiciona sessão à fila global de espera
    addSession(session){
        if(!session) throw new Error("não é possível adicionar sessão invalida");
        
        // o formato q o ffmpeg espera para os arquvios é uma string com - unicamente - o caminho do arquivo
        let sessionFiles = [];
        if(session?.files) sessionFiles = this.prepareFiles(session.files);

        const newSession = new Session(session.id, session.name, session.creator, session.startDateTime, session.endDateTime, sessionFiles, `${session.id}`);
        
        //newSession.connectToServer(this.serverUrl); // pro baleanceamento de carga bom adicionar dif servers!
        
        this.sessionsList.addSession(newSession);
        console.log(`[SessionManager]: sessão ${session.id} adicionada com sucesso!`);

        const firstSession = this.sessionsList.getNextSession();
        // caso a nova sessao seja a primeira da fila, então reagendo
        if(firstSession?.id === newSession.id){
            console.log(`[SessionManager]: reagendando sessões!`);
            this.scheduleNextSession();
        }
    }

    // atualiza sessão pasada no param
    updateSession(sessionId, session){
        try{
            let sessionFiles = "";
            if(session?.files?.length) 
                sessionFiles = this.prepareFiles(session.files);

            const updatedSession = new Session(sessionId, session.name, session.creator, session.startDateTime, session.endDateTime, sessionFiles, `${sessionId}`);
            
            if(this.sessionsList.existSession(sessionId)){
                this.sessionsList.updateSession(sessionId, updatedSession);
            
                console.log(`[SessionManager]: sessão atualizada com sucesso!`);
                this.sessionsList.getAll();

                console.log(`[SessionManager]: reagendando sessões!`);
                this.scheduleNextSession();

                return;
            }
           
            if(this.runningSessions.has(sessionId)){
                const runner = this.runningSessions.get(sessionId);
                console.log(
                    `[SessionManager]: sessão ${sessionId} está rodando. Reiniciando por update.`
                );

                runner.cancel();

                this.runningSessions.delete(sessionId);

                this.sessionsList.addSession(updatedSession);
                this.scheduleNextSession();

                return;
            }

            console.log(
                `[SessionManager]: sessão ${sessionId} não existia. Tratando update como add.`
            );

            this.sessionsList.addSession(updatedSession);
            this.scheduleNextSession();
            
        }catch(err){
            console.log(`[SessionManager]: Erro tentando atualizar a sessão ${sessionId}`, err);
        }
    }

    // inicia sessão pronta pra começar
    startSession(session){
        if(!session){
            console.log(`[SessionManager] Tentando reproduzir sessão inválida`);
            return;
        }

        if(this.runningSessions.has(session.id)){
            console.log(`[SessionManager] Sessão ${session.id} já está rodando`);
            return;
        }

        try{          
            console.log(`[SessionManager]: Iniciando sessão ${session.id}`);
            this.sessionsList.removeSession(session.id);

            const runner = new SessionRunner(session, this.serverUrl);
            this.runningSessions.set(session.id, runner);

            runner.run().finally(() => {
                console.log(`[SessionManager]: Sessão ${session.id} finalizada!`);
                this.runningSessions.delete(session.id);
            });

        }catch(err){
            console.log(`[SessionManager]: erro ao inciar sessão. ${err}`);
        
        }finally{
            this.scheduleNextSession();
        }
    }

    // verifica e incia a prox sessão a começar
    scheduleNextSession(){
        if(this.currentTimer){
            clearTimeout(this.currentTimer);
            this.currentTimer = null;
        }

        const allSessions = this.sessionsList.getAll();
        if(allSessions.length === 0){
            console.log("[SessionManager]: Nenhuma sessão na fila - aguardando novas sessões!");
            return;
        }

        const nextSession = this.sessionsList.getNextSession();

        const now = new Date();
        let delay = nextSession.startDateTime - now;

        if(delay <= 0){
            this.startSession(nextSession);
            return;
        }
        
        const MAX_TIMEOUT = 2 ** 31 - 1;
        delay = Math.min(delay, MAX_TIMEOUT);

        console.log(`[SessionManager]: Prox sessão ${nextSession.id} agendada para ${nextSession.startDateTime}`);

        this.currentTimer = setTimeout(() => {
            console.log(`[SessionManager]: Chegou a hora de reproducir a sessaõ: ${nextSession.id}`);
            this.startSession(nextSession);
        }, delay);
    }

    // remove e deleta sessão especificada no param
    cancelSession(sessionId){
        // se está na fila - ou seja, esperando
        if(this.sessionsList.existSession(sessionId)){
            this.sessionsList.removeSession(sessionId);

            this.sessionVersions.delete(sessionId);

            console.log(`[SessionManager] Sessão ${sessionId} removida da fila`);
            this.scheduleNextSession();
            return;
        }

        // se está em execução
        if(this.runningSessions.has(sessionId)){
            const runner = this.runningSessions.get(sessionId);
            
            runner.cancel();
            
            this.runningSessions.delete(sessionId);
            this.sessionVersions.delete(sessionId);

            console.log(`[SessionManager] Sessão ${sessionId} cancelada em execução`);
            return;
        }

        this.sessionVersions.delete(sessionId);
        console.log(`[SessionManager]: Sessão não encontrada!`);
    }

    // função aux para preparar os arquivos da sessão num formato compatível ffmpeg
    prepareFiles(files){
        console.log("files in prepare files ", files);
        let treatedFiles = files.splice(",");

        const isWindows = os.platform() === 'win32';
        return treatedFiles.filter(path => {
            if(!path){
                return false;
            }
            try{
                return fs.existsSync(path);
            }catch(err){
                console.log(`[SessionManager]: error in prepareFiles: ${err}`);
                return false;
            }
        })
        .map(f => {
            console.log('f:', f);
            // Resolve para caminho absoluto
            let resolvedPath = path.resolve(f);
            // Normaliza separadores conforme o SO
            resolvedPath = path.normalize(resolvedPath);

            // No Windows, converte barras invertidas (\) em barras normais (/)
            // pois o FFmpeg entende melhor o formato Unix-like.
            if (isWindows) {
                resolvedPath = resolvedPath.replace(/\\/g, '/');
            }

            // Escapa apóstrofos e espaços
            const safePath = resolvedPath.replace(/"/g, '\\"');
            console.log(`${safePath}`);
            return `${safePath}`;  
        });
    }
}

module.exports = SessionManager;