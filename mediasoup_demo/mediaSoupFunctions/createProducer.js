const createProducer =  async (localStream, producerTransport, screen = false) => {
    return new Promise(async(resolve, reject) => {
        let videoProducer = null; 
        let audioProducer = null; 

        const videoTrack = localStream.getVideoTracks()[0];
        const audioTrack = localStream.getAudioTracks()[0];

        try{
            // running the produce method, will tell the transport
            // connect event to fire (in createProducerTransport) !! 
            if(videoTrack)
            {
                if(screen){
                    // configuraçoes diferentes para compartilhamento de tela 
                    videoProducer = await producerTransport.produce({
                        track: videoTrack,
                        encodings: [{
                            maxBitrate: 1_000_000,          // 1 Mbps basta para 720p/15fps
                            scaleResolutionDownBy: 1,
                            maxFramerate: 15,
                            adaptivePtime: true,
                            priority: "low"
                        }],
                        codecOptions: {
                            videoGoogleStartBitrate: 1200,  // acelera inicialização
                            videoGoogleMaxBitrate: 2500,
                            videoGoogleMinBitrate: 300,
                            videoGoogleTemporalLayerCount: 1    // evita compressão excessiva
                        },
                        appData: { type: 'screen' }
                    });
                }else{
                    videoProducer = await producerTransport.produce({
                        track: videoTrack,
                        encodings: [
                            { rid: 'r0', maxBitrate: 200_000, scaleResolutionDownBy: 4}, 
                            { rid: 'r1', maxBitrate: 800_000, scaleResolutionDownBy: 2}, // 360p-480p
                            { rid: 'r2', maxBitrate: 2_000_000, scaleResolutionDownBy: 1}
                        ],
                        codecOptions: {
                            videoGoogleStartBitrate: 1500,
                            videoGoogleMaxBitrate: 2500,
                            videoGoogleMinBitrate: 500
                        },
                        appData: {type: 'camera'}
                    });
                console.log("Produce running on video!");
                }
            }
            
            if(audioTrack){
                audioProducer = await producerTransport.produce({
                    track: audioTrack,
                    codecOptions: {
                        opusStereo: true,
                        opusDtx: true, // desativa envio quando silêncio (menos uso de banda)
                        opusFec: true
                    },
                    encodings: [{
                        maxBitrate: 128_000, // 128 kbps para voz é ótimo
                        priority: "high"     // prioridade máxima
                    }]
                });
                console.log("Produce runnning on video!");
            }
            
            console.log("Produce finisished!");
            resolve({audioProducer, videoProducer});

        }catch(err){
            console.log(err, "error producing");
        }
    })
}

export default createProducer;