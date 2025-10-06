const config = require("../config/config");

class Client{
    constructor(userName, socket){
        this.userName = userName;
        this.socket = socket;
        // instead of calling this producerTransport, call it upstream, 
        // THIS client's transport for sending data
        this.upstreamTransport = null;
        // we will have an audio and video consumer
        this.producer = {};
        // instead of calling this consumerTransport, call it downstream, THIS client's transport
        // THIS client's transport for pulling data
        this.downstreamTransport = [];
        /*
        {
            transport, // will handle both audio and video
            associatedVideoPid,
            associatedAudioPid,
            audio = audioProducer,
            video = videoProducer
        }
        */
        // an array of cunsumers, each with 2 parts
        // this.consumers = [];
        //this.rooms = [] // case will want to do an user be able to get in a multiple rooms
        this.room = null // this will be a Room object
    }

    addTransport(type, audioPid = null, videoPid = null){
        return new Promise(async (resolve, reject) => {
            const { listenIps, initialAvailableOutgoinBitrate, maxIncomingBitrate } = config.webRtcTransport;
            const transport = await this.room.router.createWebRtcTransport({
                enableUdp: true,
                enableTcp: true, //always use udp unless we can't
                preferUdp: true,
                listenInfos: listenIps,
                initialAvailableOutgoinBitrate,
            });

            if(maxIncomingBitrate){
                // maxIncomingBitrate limit the incoming bandwidth from this transport
                try{
                    await transport.setMaxIncomingBitrate(maxIncomingBitrate);

                }catch(err){
                    console.log("ERR SENDING BITRATE");
                    console.log(err);
                }
            }

            //console.log(transport);
            const clientTransportParams = {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            }

            if(type === 'producer'){
                // set the new transport to the clients's upstreamTransport
                this.upstreamTransport = transport;
                // setInterval(async () => {
                //     const stats = await this.upstreamTransport.getStats();
                //     for(const report of stats.values()){
                //         if(report.type == "webrtc-transport"){
                //             console.log(report.bytesReceived, '-', report.rtpBytesReceived);
                //             //console.log(report);
                //         }
                //     }
                // }, 1000);

            }else if(type === 'consumer'){
                // add the new transport and the 2 pids, to downstream transport 
                this.downstreamTransport.push({
                    transport, // will handle both audio and video
                    associatedVideoPid: videoPid,
                    associatedAudioPid: audioPid
                });
            }
            resolve(clientTransportParams);
        });
    }

    addProducer(kind, newProducer){
        this.producer[kind] = newProducer;
        if(kind === 'audio'){
            // add this to out activeSpeakerObserver
            this.room.activeSpeakerObserver.addProducer({
                producerId: newProducer.id
            });
        }
    }

    addConsumer(kind, newConsumer, downstreamTransport){
        downstreamTransport[kind] = newConsumer;
    }
}

module.exports = Client;