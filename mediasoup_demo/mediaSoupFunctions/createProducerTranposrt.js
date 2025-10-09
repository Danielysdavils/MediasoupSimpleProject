const createProduceTransport = (socket, device) => new Promise(async(resolve, reject) => {
    // ask the server to make a tranpsort and send params
    const producerTransportParams = await socket.emitWithAck('requestTransport', { type:'producer' });
    console.log(producerTransportParams);

    //use the device to create a front-end transport to sned
    // it takes our object from requestTransport
    const producerTransport = device.createSendTransport(producerTransportParams);
    console.log(producerTransport);

    producerTransport.on('connect', async ({dtlsParameters}, callback, errback) => {
        // transport connect event woll NOT fire until transport.produce() runs
        // the other half of the connection
        // emit connectTransport
        console.log("Connect running on produce...");
        const connectResp = await socket.emitWithAck("connectTransport", {dtlsParameters, type: 'producer'});
        console.log(connectResp, "connect rasp is back!");

        if(connectResp === 'success'){
            // we are connected! move forward
            callback();
        }else if(connectResp === 'error'){
            // connection failed. Stop
            errback()
        }
    });

    producerTransport.on('produce', async(parameters, callback, errback) => {
        // emit startProducing
        console.log("Produce is now running!");
        const { kind, rtpParameters } = parameters;
        console.log("AQUI DEVERIA APARECER AUDII E VIDEO", kind);

        const produceResp = await socket.emitWithAck('startProducing', {kind, rtpParameters});
        console.log(produceResp, "produceResp is back!");

        if(produceResp === 'error'){
            errback();
        }else{
            // only other option is the producer id
            callback({id: produceResp});
        }
    });

    // debug connection
    // setInterval(async () => {
    //     const stats = await producerTransport.getStats();
    //     for(const report of stats.values()){
    //         //console.log(report);
    //         if(report.type == "outbound-rtp"){
    //             console.log(report.bytesSent, '-', report.packetsSent);
    //         }
    //     }
    // }, 1000);

    // send the trnasport back to main
    resolve(producerTransport);
});


export default createProduceTransport;