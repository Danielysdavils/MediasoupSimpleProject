const path = require("path")
const fs = require("fs")
const os = require ("os")

const Session = require("./Session");
const SessionQueue = require("./SessionQueue");

class SessionManager{
    constructor(serverUrl){
        this.serverUrl = serverUrl,
        this.sessionsList = new SessionQueue();
        this.checkInterval = 1000;
        this.startScheduler();
    }

    // adiciona sessão à fila global
    addSession(session){
        if(!session) throw new Error("não é possível adicionar sessão invalida");
        
        // o formato q o ffmpeg espera para os arquvios é uma string com - unicamente - o caminho do arquivo
        let sessionFiles = "";
        if(session?.files?.length) sessionFiles = this.prepareFiles(session.files);

        console.log("session startDateTime: ", session.startDateTime);

        // verificar como vou receber o objeto sessão aqui (*)
        const newSession = new Session(session.id, session.name, session.creator, session.startDateTime, session.endDateTime, sessionFiles, `${session.id}`);
        newSession.connectToServer(this.serverUrl); // pro baleanceamento de carga bom adicionar dif servers!
        this.sessionsList.addSession(newSession);
        
        console.log(`[SessionManager]: sessão ${session.id} adicionada com sucesso!`);
        console.log("all: ", this.sessionsList.getAll());
    }

    // atualiza sessão pasada no param
    updateSession(sessionId, session){
        if(!this.sessionsList.existSession(sessionId)) throw new Error("Tentando atualizar sessão não existente!");
        
        let sessionFiles = "";
        if(session?.files?.length) sessionFiles = this.prepareFiles(session.files);

        const updatedSession = new Session(sessionId, session.name, session.creator, session.startDateTime, session.endDateTime, sessionFiles, `${sessionId}`);
        this.sessionsList.updateSession(sessionId, updatedSession);
        
        console.log(`[SessionManager]: sessão atualizada com sucesso!`);
        this.sessionsList.getAll();
    }

    // inicia sessão pronta pra começar
    startScheduler(){
        console.log("Start schefule?");
        setInterval(() => {
            console.log("realmente confere?");
            const now = new Date();
            console.log("lista atual: ",  this.sessionsList.getAll());
            let currentSession = this.sessionsList.removeFirtsSession();
            console.log('currentSession: ', currentSession);

            if(currentSession && currentSession.startDateTime <= now){
                console.log(`[SessionManager]: Iniciando sessão ${currentSession.id}`);
                currentSession.startTransmission();
            } 
        }, this.checkInterval);
    }

    // remove e deleta sessão especificada no param
    cancelSession(sessionId){
        if(this.sessionsList.existSession(sessionId)){
            let toDeleteSession = this.sessionsList.removeSession(sessionId);
            if(toDeleteSession) toDeleteSession.cancel();

            console.log(`[SessionManager] Sessão ${id} cancelada`);
        }else{
            console.log(`[SessionManager]: tentando deletar sessão inválida`);
        }
    }

    // função aux para preparar os arquivos da sessão num formato compatível ffmpeg
    prepareFiles(files = []){
        if(!files?.length) return '';

        const isWindows = os.platform() === 'win32';

        return files.filter(f => {
            if(!f?.fullPath) return false;
            try{
                return fs.existsSync(f.fullPath);
            }catch(err){
                console.log(`[SessionManager]: error in prepareFiles: ${err}`);
                return false;
            }
        })
        .map(f => {
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
            const safePath = resolvedPath.replace(/'/g, "'\\''");
            return `file '${safePath}'`;  
        })
        .join('\n');
    }
}

module.exports = SessionManager;