const closePlainTransport = async (socket) => 
    new Promise(async(resolve, reject) => {
        const videoPlainTransportParams = await socket.emitWithAck('closePlainTransport', { transportType: 'videoHeadless' });
        const audioPlainTransportParams = await socket.emitWithAck('closePlainTransport', { transportType: 'audioHeadless' });
        
        resolve(videoPlainTransportParams === 'success' && audioPlainTransportParams === 'success' ? true : false);
});

module.exports = closePlainTransport;