const updateActiveSpeaker = (room, io) => {
    /*
        this function is called on newDominantSpeaker, or a new peer produces
            mutes existing consumers/producer if bellow 5, for all peers in room
            unmutes existing consumers/producers if in top 6, for all peers in room
            return new transport by peer
        called by either activeSpeakerObserver (newDominantSpeaker) or startProducing
    */

    const activeSpeakers = room.activeSpeakerList.slice(0,5);
    const mutedSpeakers = room.activeSpeakerList.slice(5);
    const newTransportByPeer = {};
    // loop through all connected clients in the room
    room.clients.forEach(client => {
        // loop through all clients to mute
        mutedSpeakers.forEach(pid => {
            // pid is the producer id we want to mute
            if(client?.producer?.audio?.id === pid){
                // this clietn is the producer. Mute the producer
                client?.producer?.audio.pause();
                client?.producer?.video?.pause();
                return;
            }
            const downstreamToStop = client.downstreamTransport.find(t => t?.audio?.producerId === pid);
            if(downstreamToStop){
                // found the audio, mute both
                downstreamToStop.audio.pause();
                downstreamToStop.video?.pause();
            }// no else. Do nothing if no math
        });
        // store all the pid's this client is not yet consuming
        const newSpeakersToThisClient = [];
        activeSpeakers.forEach(pid => {
            if(client?.producer?.audio?.id === pid){
                // this clietn is the producer. Resume the producer
                client?.producer?.audio.resume();
                client?.producer?.video?.resume();
                return;
            }
            // can grab pid from the audi.producer like above, or use or own associatedAudioPid
            const downstreamToStart = client.downstreamTransport.find(t => t?.associatedAudioPid === pid);
            if(downstreamToStart){
                // we have a math. Just resume
                downstreamToStart?.audio.resume();
                downstreamToStart?.video?.resume();
            }else{
                // this client is not consuming... start the process
                newSpeakersToThisClient.push(pid);
            }
        });
        if(newSpeakersToThisClient.length){
            // this client has at least 1 new consumer/transport to make
            // at socket.id key, put the array of newSpeakers to make
            // if there were no newSpeakers, then there will be no key for that client
            newTransportByPeer[client.socket.id] = newSpeakersToThisClient;
        }
    });

    // client loop is done. We have muted or unmute all producers/consumers
    // based on the new activeSpeakerList. Now, send out the consumers that
    // need to be made. 
    // Broadcast to this room
    io.to(room.roomName).emit('updateActiveSpeakers', activeSpeakers);
    return newTransportByPeer;
}

module.exports = updateActiveSpeaker;