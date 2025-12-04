const path = require("path")
const fs = require("fs")
const os = require ("os")

const Session = require("./Session");
const SessionQueue = require("./SessionQueue");

class SessionManager{
    constructor(serverUrl){
        this.serverUrl = serverUrl,
        this.sessionsList = new SessionQueue();
        this.currentTimer = null;
    }

    // adiciona sessão à fila global
    addSession(session){
        if(!session) throw new Error("não é possível adicionar sessão invalida");
        
        // o formato q o ffmpeg espera para os arquvios é uma string com - unicamente - o caminho do arquivo
        let sessionFiles = "";
        if(session?.files?.length) sessionFiles = this.prepareFiles(session.files);

        // verificar como vou receber o objeto sessão aqui (*)
        const newSession = new Session(session.id, session.name, session.creator, session.startDateTime, session.endDateTime, sessionFiles, `${session.id}`);
        newSession.connectToServer(this.serverUrl); // pro baleanceamento de carga bom adicionar dif servers!
        this.sessionsList.addSession(newSession);
        
        console.log(`[SessionManager]: sessão ${session.id} adicionada com sucesso!`);
        console.log("all: ", this.sessionsList.getAll());

        console.log(`[SessionManager]: reagendando sessões!`);
        this.scheduleNextSession();
    }

    // atualiza sessão pasada no param
    updateSession(sessionId, session){
        if(!this.sessionsList.existSession(sessionId)) throw new Error("Tentando atualizar sessão não existente!");
        
        try{
            let sessionFiles = "";
            if(session?.files?.length) sessionFiles = this.prepareFiles(session.files);

            const updatedSession = new Session(sessionId, session.name, session.creator, session.startDateTime, session.endDateTime, sessionFiles, `${sessionId}`);
            this.sessionsList.updateSession(sessionId, updatedSession);
            
            console.log(`[SessionManager]: sessão atualizada com sucesso!`);
            this.sessionsList.getAll();

            console.log(`[SessionManager]: reagendando sessões!`);
            this.scheduleNextSession();

        }catch(err){
            console.log(`[SessionManager]: Erro tentando atualizar a sessão!`);
        }
    }

    // inicia sessão pronta pra começar
    async startSession(session){
        if(!session){
            console.log("Tentando reproduzir sessão invalida!");
            return;
        }

        if(session.status === "running"){
            console.log(`[SessionManager]: Sessão ${session.id} já está em execução. Ignorando!`);
        }

        try{          
            console.log(`[SessionManager]: Iniciando sessão ${session.id}...`);
            await session.start();

        }catch(err){
            console.log(`[SessionManager]: erro ao inciar sessão. ${err}`);
        }

        // reprogramo a próx sessão a ser iniciada
        this.scheduleNextSession();
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

        const nextSession = this.sessionsList.removeFirtsSession();
        const now = new Date();
        const delay = nextSession.startDateTime - now;

        if(delay <= 0){
            this.startSession(nextSession);
            return;
        }

        console.log(`[SessionManager]: Prox sessão ${nextSession.id} agendada para ${nextSession.startDateTime}`);

        this.currentTimer = setTimeout(async () => {
            console.log(`chegou a hora de reproducir a sessaõ: ${nextSession.id}...!!`);
            await this.startSession(nextSession);
        }, delay);
    }

    // remove e deleta sessão especificada no param
    cancelSession(sessionId){
        if(this.sessionsList.existSession(sessionId)){
            let toDeleteSession = this.sessionsList.removeSession(sessionId);
            if(toDeleteSession) toDeleteSession.cancel();

            console.log(`[SessionManager] Sessão ${id} cancelada`);
            this.scheduleNextSession();
        }else{
            console.log(`[SessionManager]: tentando deletar sessão inválida`);
        }
    }

    // função aux para preparar os arquivos da sessão num formato compatível ffmpeg
    prepareFiles(files = []){
        if(!files?.length) return '';

        console.log("init")
        const isWindows = os.platform() === 'win32';

        return files.filter(f => {
            if(!f?.fullPath){
                console.log("!f?.fullpath")
                return false;
            }
            try{
                console.log("ok? : ", fs.existsSync(f.fullPath))
                return fs.existsSync(f.fullPath);
            }catch(err){
                console.log(`[SessionManager]: error in prepareFiles: ${err}`);
                return false;
            }
        })
        .map(f => {
            console.log('f:', f);
            // Resolve para caminho absoluto
            let resolvedPath = path.resolve(f.fullPath);
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