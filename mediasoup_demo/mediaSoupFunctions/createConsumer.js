const createConsumer = (consumerTransport, pid, device, socket, kind, slot) => {
    return new Promise(async(resolve, reject) => {
        // consume from the basic, emit the consumeMedia event, we take
        // the params we get back, and run consume(). That gives us or track
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
            console.log("consume() has finished!");

            if(kind === 'video'){
                try{
                    await consumer.setPreferredLayers({
                        spatialLayer: 0,   // resolução mais baixa
                        temporalLayer: 0   // frame rate mais baixo
                    });
                }catch(err){
                    console.log("ERROR SETTING PREFERED LAYERS!", err);
                }
            }
            const { track } = consumer;
            // add track events
            // unpause
            await socket.emitWithAck('unpauseConsumer', {pid, kind});
            resolve(consumer);
        }
    });
}

export default createConsumer;