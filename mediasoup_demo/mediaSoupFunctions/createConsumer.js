const createConsumer = (consumerTransport, pid, device, socket, kind, slot) => {
    return new Promise(async(resolve, reject) => {
        // consume from the basic, emit the consumeMedia event, we take
        // the params we get back, and run consume(). That gives us or track
        console.log("device tem suporte rids? ", device.rtpCapabilities);
        const consumeParams = await socket.emitWithAck('consumeMedia', {rtpCapabilities: device.rtpCapabilities, pid, kind});
        console.log(consumeParams);
        if(consumeParams === 'noTransport'){
            console.log("noTransport");
            resolve();
        }

        if(consumeParams === 'cannotConsume'){
            console.log("cannot consume");
            resolve();
        }else if(consumeParams === 'consumeFailed'){
            console.log("consume failed")
            resolve();
        }else{
            const consumer = await consumerTransport.consume(consumeParams);
            console.log("Consumer: ", consumer);
            console.log("Consumer type: ", consumer.type);
            console.log("Consumer rtpParameters: ", consumer.rtpParameters.codecs)
            console.log("consume() has finished!");
            console.log("consume kind: ", kind);
            
            if(kind === 'video'){
                try{
                    await consumer.setPreferredLayers({
                        spatialLayer: 2,   // resolução mais baixa
                        temporalLayer: 1   // frame rate mais baixo
                    });
                }catch(err){
                    console.log("ERROR SETTING PREFERED LAYERS!", err);
                }
            }
            const { track } = consumer;
            // add track events
            // unpause
            await socket.emitWithAck('unpauseConsumer', {pid, kind}); // é boa pártica mandar track como pause, entao aqui despause
            resolve(consumer);
        }
    });
}

export default createConsumer;