/**
 * Queue de processos
 *  -> evita race condition entre eventos async
 *  -> garante ordem de processos async
 */
class TaskQueue {
    constructor(){
        this.queue = Promise.resolve();
    }

    add(task){
        this.queue = this.queue
            .then(() => task())
            .catch(err => {
                console.error("[Queue error]", err);
            });
        
        return this.queue;
    }
}

module.exports = TaskQueue;