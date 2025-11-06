const createPlainTransport = async (socket, room) => 
    new Promise(async(resolve, reject) => {
        const videoPlainTransportParams = await socket.emitWithAck('requestPlainTransport', { room, transportType: 'videoHeadless' });
        const audioPlainTransportParams = await socket.emitWithAck('requestPlainTransport', { room, transportType: 'audioHeadless' });
        
        console.log("videoPlainTransportParams: ", videoPlainTransportParams);
        console.log("audioPlainTransportParams: ", audioPlainTransportParams);

        resolve({
            video_ip : videoPlainTransportParams.ip,
            video_port: videoPlainTransportParams.port,
            video_rtcpPort: videoPlainTransportParams.rtcpPort,
            audio_ip: audioPlainTransportParams.ip,
            audio_port: audioPlainTransportParams.port,
            audio_rtcpPort: audioPlainTransportParams.rtcpPort
        });
});

module.exports = createPlainTransport;