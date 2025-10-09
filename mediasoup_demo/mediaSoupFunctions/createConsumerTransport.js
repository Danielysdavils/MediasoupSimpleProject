const createConsumerTransport = (transportParams, device, socket, audioPid) => {
    // make a donwstream transport for ONE producer/peer/client (with audio and video producer)
    
    // const consumerTransport = device.createRecvTransport(transportParams, [
    //     { urls: 'stun:stun.l.google.com:19302' } // pode funcionar mesmo offline; em LAN é ignorado
    // ]);
    const consumerTransport = device.createRecvTransport(transportParams);
    
    consumerTransport.on('connectionstatechange', state => {
        console.log("===conectionstatechange===");
        console.log(state);
    });

    consumerTransport.on('icegatheringstatechange', state => {
        console.log('==icegatheringstatechange==');
        console.log(state);
    });

    // transport connect listener... fires on .consume()
    consumerTransport.on('connect', async({dtlsParameters}, callback, errback) => {
        console.log("Tranport connect event has fired!");
        // connect comes with local dtlsParameters. We need
        // to send these up to the server, so we can finish
        // the connection 
        const connectResp = await socket.emitWithAck('connectTransport', {dtlsParameters, type: 'consumer', audioPid});
        console.log(connectResp, "connect resp is back");

        if(connectResp == "success"){
            callback(); //this will finish our wait consume
        }else{
            errback();
        }
    });

    return consumerTransport;
}


export default createConsumerTransport;