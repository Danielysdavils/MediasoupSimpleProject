const updateActiveSpeaker = (room, io) => {
    console.log("update active speaker")
    const newTransportByPeer = {};
    const activeSpeakers = room.currentProducers.map(p => p?.producer?.audio?.id).filter(id => !!id);
    console.log('producers in activeSpeaker', room.currentProducers);
    console.log('activeSpeakers:', activeSpeakers);

    for (const client of room.clients) {
        const newSpeakersToThisClient = [];

        for (const p of room.currentProducers) {
            const aPid = p.producer?.audio?.id;
    
            const vScreenPid = p.producer?.videoScreen?.id;
            const aScreenPid = p.producer?.audioScreen?.id;

            if (client?.producer?.audio && client.producer.audio.id === aPid) {
                client.producer.audio.resume();
                client?.producer?.video?.resume();

                client?.producer?.audioScreen?.resume();
                client?.producer?.videoScreen?.resume();
            }

            const downstream = client.downstreamTransport.find(
                t => t?.associatedAudioPid === aPid  
            );

            const downsstreamScreen_v = client.downstreamTransport.find(
                t => t?.associatedVideoScreenPid === vScreenPid
            );

            console.log("down v: ", downsstreamScreen_v)

            const downsstreamScreen_a = client.downstreamTransport.find(
                t => t?.associatedAudioScreenPid === aScreenPid
            )

            console.log("dow a: ", downsstreamScreen_a)

            if(downstream){
                downstream.audio.resume(); 
                downstream.video?.resume();

            }else if(!downstream && aPid){
                newSpeakersToThisClient.push(aPid);
            }

            if(downsstreamScreen_v){
                downsstreamScreen_v.videoScreen?.resume(); 
            }

            if(downsstreamScreen_a){
                downsstreamScreen_a.audioScreen?.resume();
            }

           if(vScreenPid){
                console.log("vScreenValido!");

                if(!downsstreamScreen_v && !downsstreamScreen_a){
                    console.log("add !v && !a")
                    newSpeakersToThisClient.push(aPid);
                }

                if((!downsstreamScreen_v && downsstreamScreen_a) || (downsstreamScreen_v && !downsstreamScreen_a && aScreenPid)){
                    console.log("add (!v && a) || (v && !a)")
                    newSpeakersToThisClient.push(aPid);
                }
           }
        }

        if (newSpeakersToThisClient.length > 0) {
            newTransportByPeer[client.socket.id] = newSpeakersToThisClient;
        }
    }

    // Emite pro front
    io.to(room.roomName).emit('updateActiveSpeakers', activeSpeakers);
    return newTransportByPeer;
};

module.exports = updateActiveSpeaker;