const createProducerTransport = async (socket) => {
    return new Promise(async(resolve, reject) => {
        const rtpParametersVideo = {
            codecs: [{
                mimeType: "video/vp8",
                payloadType: 102,
                clockRate: 90000
            }],
            encodings: [{ ssrc: 22222222 }],
            //rtcp: { cname: "CNAME" },
        };

        const rtpParametersAudio = {
            codecs: [{
                mimeType: "audio/opus",
                payloadType: 101,
                clockRate: 48000,
                channels: 2,
            }],
            encodings: [{ ssrc: 11111111 }],
            //rtcp: { cname: "CNAME" },
        };

        const videoProducerId = await socket.emitWithAck("startProducing", { 
            kind: "video", 
            rtpParameters: rtpParametersVideo,
            transportType: 'videoHeadless', 
        });

        const audioProducerId = await socket.emitWithAck("startProducing", { 
            kind: "audio", 
            rtpParameters: rtpParametersAudio,
            transportType: 'audioHeadless',
        });

        resolve({audioProducerId, videoProducerId});
    });
}


module.exports = createProducerTransport;