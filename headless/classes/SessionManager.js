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

        // verificar como vou receber o objeto sessão aqui (*)
        const newSession = new Session(session.id, session.name, session.creator, session.startDateTime, session.endDateTime, sessionFiles, `${session.id}`);
        newSession.connectToServer(this.serverUrl); // pro baleanceamento de carga bom adicionar dif servers!
        this.sessionsList.addSession(newSession);
        
        console.log(`[SessionManager]: sessão ${session.id} adicionada com sucesso!`);
    }

    // atualiza sessão pasada no param
    updateSession(sessionId, session){
        if(!this.sessionsList.existSession(sessionId)) throw new Error("Tentando atualizar sessão não existente!");
        
        let sessionFiles = "";
        if(session?.files?.length) sessionFiles = this.prepareFiles(session.files);

        const updatedSession = new Session(sessionId, session.name, session.creator, session.startDateTime, session.endDateTime, sessionFiles, `${sessionId}`);
        this.sessionsList.updateSession(sessionId, updatedSession);
        
        console.log(`[SessionManager]: sessão atualizada com sucesso!`);
    }

    // inicia sessão pronta pra começar
    startScheduler(){
        setInterval(() => {
            const now = new Date();
            let currentSession = this.sessionsList.removeSession();
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
        return files.length
            ? files.map(f => `file '${f.fullPath}'`).join('\n')
            : '';
    }
}

module.exports = SessionManager;