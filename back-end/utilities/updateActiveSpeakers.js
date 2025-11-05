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

            const downsstreamScreen_a = client.downstreamTransport.find(
                t => t?.associatedAudioScreenPid === aScreenPid
            )

            if(downstream){
                downstream.audio.resume(); 
                downstream.video?.resume();

            }else if(!downstream && aPid){
                console.log("add !downstream && aPID")
                newSpeakersToThisClient.push(aPid);
            }

            if(downsstreamScreen_v && aPid){
                downsstreamScreen_v.videoScreen?.resume(); 

            }else if(!downsstreamScreen_v && vScreenPid && aPid){
                console.log("add !downstreamScreen_v && vScreenPid && aPid")
                newSpeakersToThisClient.push(aPid);
            }  
            
            if(downsstreamScreen_a && aPid){
                downsstreamScreen_a.audioScreen?.resume()
            
            }else if(!downsstreamScreen_a && aScreenPid && aPid){
                console.log("!downstreamScree_a && aScreenPid && aPid")
                newSpeakersToThisClient.push(aPid);
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