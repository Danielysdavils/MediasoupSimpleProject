const updateActiveSpeaker = (room, io) => {
    console.log("update active speaker")
    const newTransportByPeer = {};
    const activeSpeakers = room.currentProducers.map(p => p?.producer?.audio?.id).filter(id => !!id);
    console.log('producers in activeSpeaker', room.currentProducers);
    console.log('activeSpeakers:', activeSpeakers);

    for (const client of room.clients) {
        const newSpeakersToThisClient = [];

        for (const p of room.currentProducers) {
        const aPid = p.producer.audio?.id;

        if (client?.producer?.audio && client.producer.audio.id === aPid) {
            client.producer.audio.resume();
            client?.producer?.video?.resume();
        }

        const downstream = client.downstreamTransport.find(
            t => t?.associatedAudioPid === aPid
        );

        if (downstream) {
            downstream.audio.resume();
            downstream.video?.resume();
        } else {
            if(aPid) newSpeakersToThisClient.push(aPid);
        }
        }

        if (newSpeakersToThisClient.length) {
        newTransportByPeer[client.socket.id] = newSpeakersToThisClient;
        }
    }

    // Emite pro front
    io.to(room.roomName).emit('updateActiveSpeakers', activeSpeakers);
    return newTransportByPeer;
};

module.exports = updateActiveSpeaker;