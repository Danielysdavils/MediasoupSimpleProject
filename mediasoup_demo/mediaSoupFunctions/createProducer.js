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
                            { rid: 'r0', maxBitrate: 150_000, scaleResolutionDownBy: 4 }, // 144p-240p
                            { rid: 'r1', maxBitrate: 500_000, scaleResolutionDownBy: 2 }, // 360p-480p
                            { rid: 'r2', maxBitrate: 1_200_000 }
                        ],
                        codecOptions: {
                            videoGoogleStartBitrate: 1000
                        }
                    });
                console.log("Produce running on video!");
                }
            }
            
            if(audioTrack){
                audioProducer = await producerTransport.produce({track: audioTrack});
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