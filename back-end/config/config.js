//rtcMinPort and max are just arbitray ports for our traffic
//useful for firewall or networking rules
const config = {
    port: 3031,
    workerSettings: {
        rtcMinPort: 40000,
        rtcMaxPort: 41000,
        logLevel: 'warn',
        logTags: [
            'info',
            'ice',
            'dtls',
            'rtp',
            'srtp',
            'rtcp'
        ]
    },
    routerMediaCodecs: [  
        {
            kind: "audio",
            mimeType: "audio/opus",
            clockRate: 48000,
            channels: 2,
            parameters: {
                "maxaveragebitrate": 64000,
                "useinbandfec": 1,
                "usedtx": 1,
                "stereo": 0

            }
        },
        // {
        //     kind: "audio",
        //     mimeType: "audio/PCMU",
        //     clockRate: 8000,
        //     channels: 1
        // },
        {
            kind: "video",
            mimeType: "video/H264",
            clockRate: 90000,
            parameters:
            {
                "packetization-mode": 1,
                "profile-level-id": "42e01f",
                "level-asymmetry-allowed": 1
            }
        },
        {
            kind: "video",
            mimeType: "video/VP8",
            clockRate: 90000,
            parameters: {}
        }
    ],
    webRtcTransport: {
        listenIps: [
            {
                ip: '172.233.24.100', // '172.233.24.100', //local: 127.0.0.1
                aouncedIp: '172.233.24.100' // '172.233.24.100' // replace by public address
                //anouncedIp: serverIp
            }
        ],
        // For a typical video stream with HD quality, you might set maxIncomingBitrate
        // around 5Mbps (5000 kbps) to balance quality and bandwidth
        // 4k Ultra HD: 15bps to 25 Mbps
        maxIncomingBitrate: 8_000_000, // 5000000, // 5 Mbps, default is INF
        initialAvailableOutgoinBitrate: 6_000_000 // 5 Mbps, default is 600000
    }
}

module.exports = config;