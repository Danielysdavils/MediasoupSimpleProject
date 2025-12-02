const closeProducerTransport = async (socket) => {
    return new Promise(async(resolve, reject) => {
        const videoProducer = await socket.emitWithAck("closeProducer", { kind: "video" });
        const audioProducer = await socket.emitWithAck("closeProducer", { kind: "audio" });

        resolve(videoProducer === 'success' && audioProducer === 'success' ? true : false);
    });
}


module.exports = closeProducerTransport;