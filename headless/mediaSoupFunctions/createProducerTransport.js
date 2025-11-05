const createProducerTransport = async (socket) => {
    return new Promise(async(resolve, reject) => {
        const rtpParametersVideo = {
            codecs: [{
                mimeType: "video/H264",
                payloadType: 103,
                clockRate: 90000,
                parameters: {
                    'packetization-mode': 1,
                    'profile-level-id': '42e01f'
                }
            }],
            encodings: [{ ssrc: 22222222 }],
            rtcp: { cname: "CNAME" },
        };

        const rtpParametersAudio = {
            codecs: [{
                mimeType: "audio/opus",
                payloadType: 111,
                clockRate: 48000,
                channels: 2,
            }],
            encodings: [{ ssrc: 11111111 }],
            rtcp: { cname: "CNAME" },
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