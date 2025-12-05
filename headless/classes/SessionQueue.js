/*
    FILA DE PRIORIDADE DE SESSÕES (SESSION QUEUE)

    Adiciona sessões usando como parametro de prioridade o startDateTime da mesma:
        - sessões com datas mais antigas irão ter prioridade menor; 
        - sessões com datas mais recentes irão ir primeiro na fila.
        - é esperado por desing que as sessões mais antigas sejam de no máx 1/2 minutos de diferença. 
*/
class SessionQueue{
    constructor(){
        this.sessions = [];
    }

    /* add a new session into the session queue. The session start dateTime is the priority of the queue */
    addSession(session){
        console.log(session);
        if(!session || !session.startDateTime){
            throw new Error("Sessão inválida: é necessário um startDateTime valido");
        }

        const start = new Date(session.startDateTime);
        if(isNaN(start.getTime())){
            throw new Error("startDateTime inválido");
        }

        let index = this.sessions.findIndex(
            (s) => new Date(s.startDateTime) > start
        );

        if(index === -1){
            // se for a maior data, adiciona no fim
            this.sessions.push(session);
        }else{
            // Insere antes do primeiro elemento com data maior
            this.sessions.splice(index, 0, session);
        }
    }

    /* update a session that exist into the queue */
    updateSession(sessionId, updatedSession){
        if(!this.existSession(sessionId)) throw new Error(`Tentando atualizar sessão que não existe: ${sessionId}`);
        if(!updatedSession) throw new Error("Dados da Sessão a atualizar inválidos!");

        const index = this.sessions.findIndex((s) => s.id === sessionId);
        if(index === -1) throw new Error("Sessão não encontrada");

        const olderSession = this.sessions[index];

        if(olderSession.status === "running") throw new Error("não é possível atualizar sessões que já estão rodando!");

        const olderDate = new Date(olderSession.startDateTime).getTime();
        const newDate = new Date(updatedSession.startDateTime).getTime();

        // Atualiza os dados da sessão
        this.sessions[index] = { ...olderSession, ...updatedSession };

        // caso a atualização seja na data precisa reajustar sua posição na lista 
        if(olderDate !== newDate){
            const updated = this.sessions.splice(index, 1)[0];
            this.addSession(updated);
        }
    }

    // remove the firts element of queue
    removeFirtsSession(){
        return this.sessions.shift();
    }

    // remove the session indicated in the parameter (id)
    removeSession(sessionId){
        if(!sessionId){
            throw new Error("rentando remover sessão invalida!");
        }

        const index = this.sessions.findIndex((s) => s.id === sessionId);
        if(index !== -1){
            return this.sessions.splice(index, 1)[0];
        }

        return null;
    }

    // check if exist a session indicated in the parameter
    existSession(sessionId){
        return this.sessions.some((s) => s.id === sessionId);
    }

    // reset the queue
    destroiQueue(){
        this.sessions = [];
    }

    // get all elements from the queue
    getAll(){
        return [...this.sessions];
    }

    // get the next element in the queue (index 0)
    getNextSession(){
        return this.sessions.length > 0 ? this.sessions[0] : null;
    }
}

module.exports = SessionQueue;