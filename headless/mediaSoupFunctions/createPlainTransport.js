const createPlainTransport = async (socket, room) => 
    new Promise(async(resolve, reject) => {
        const videoPlainTransportParams = await socket.emitWithAck('requestPlainTransport', { room, transportType: 'videoHeadless' });
        const audioPlainTransportParams = await socket.emitWithAck('requestPlainTransport', { room, transportType: 'audioHeadless' });
        
        console.log("videoPlainTransportParams: ", videoPlainTransportParams);
        console.log("audioPlainTransportParams: ", audioPlainTransportParams);

        resolve({videoPlainTransportParams, audioPlainTransportParams});
});

module.exports = createPlainTransport;