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
       
        // verificar como vou receber o objeto sessão aqui (*)
        const newSession = new Session(session.id, session.name, session.creator, session.startDateTime, session.endDateTime, session.files, `${session.id}`);
        newSession.connectToServer(this.serverUrl); // pro baleanceamento de carga bom adicionar dif servers!
        this.sessionsList.addSession(newSession);
        console.log(`[SessionManager]: sessão ${session.id} adicionada com sucesso!`);
    }

    // atualiza sessão pasada no param
    updateSession(sessionId, session){
        if(!this.sessionsList.existSession(sessionId)) throw new Error("Tentando atualizar sessão não existente!");
        
        const updatedSession = new Session(sessionId, session.name, session.creator, session.startDateTime, session.endDateTime, session.files, `${sessionId}`);
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
}

module.exports = SessionManager;