function getWorker(workers){
    // Outside promise for the main program to resolve the desired worker
    return new Promise(async(resolve, reject) => {
        // inside promises (in array) for each worker to calculate it's useage
        const workersLoad = workers.map(worker => {
            // put this Promise on the array (will init as Pending)
            return new Promise(async(resolve, reject) => {
                const stats = await worker.getResourceUsage();
                // this calculates cumulative load, not current
                // we'd need a setTimeout to do that
                const cpuUsage = stats.ru_time + stats.ru_stime;
                // this worker is done, resolve it. Promise.all will rum with all are done
                resolve(cpuUsage);
            })
        })

        const workersLoadCalc = await Promise.all(workersLoad);
        let leastLoadedWorker = 0;
        let leastWorkerLoad = workersLoadCalc[0];
        
        for(let i = 0; i < workersLoadCalc.length; i++){
            if(workersLoadCalc[i] < leastWorkerLoad){
                leastWorkerLoad = workersLoadCalc[i];
                leastLoadedWorker = i;
            }
        }

        resolve(workers[leastLoadedWorker]);
    })
}

module.exports = getWorker;