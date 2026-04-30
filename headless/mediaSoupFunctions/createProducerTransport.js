const createProducerTransport = async (socket) => {
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

    const videoProducer = await socket.emitWithAck("plain:producer:start", {
        kind: "video",
        rtpParameters: rtpParametersVideo,
        appData: { source: "screenVideo" },
        purpose: "video"
    });

    const audioProducer = await socket.emitWithAck("plain:producer:start", {
        kind: "audio",
        rtpParameters: rtpParametersAudio,
        appData: { source: "screenAudio" },
        purpose: "audio"
    });

    return { audioProducer, videoProducer };
}

module.exports = createProducerTransport;