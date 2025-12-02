const closeProducerTransport = async (socket) => {
    return new Promise(async(resolve, reject) => {
        const videoProducer = await socket.emitWithAck("closeProducer", { kind: "video" });
        const audioProducer = await socket.emitWithAck("closeProducer", { kind: "audio" });

        if(videoProducer === 'success' && audioProducer === 'success') resolve(true);
        else resolve(false);
    });
}


module.exports = closeProducerTransport;