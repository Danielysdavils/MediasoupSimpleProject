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
            const screenPid = p.producer.videoScreen?.id;
            console.log("SCREEN PID? ", screenPid);

            if (client?.producer?.audio && client.producer.audio.id === aPid) {
                client.producer.audio.resume();
                client?.producer?.video?.resume();

                client?.producer?.audioScreen?.resume();
                client?.producer?.videoScreen?.resume();
            }

            /*
                Aqui podemos ter dois downstreamTransports, um para a tela e outro para a webcam.
                Por isso precisamos filtrar e despausar conforme o caso
            */
            const downstreamWebcam = client.downstreamTransport.find(
                t => t?.associatedAudioPid === aPid  
            );

            const downsStreamScreen = client.downstreamTransport.find(
                t => t?.associatedVideoPid === screenPid
            );

            if(downstreamWebcam){
                downstreamWebcam.audio.resume(); // audio sempre obrigatorio para webcam
                downstreamWebcam.video?.resume(); // video opcional
            }else if(aPid) newSpeakersToThisClient.push(aPid);

            if(downsStreamScreen){
                downsStreamScreen.audio?.resume(); // audio opcional para compartilhamento de tela
                downsStreamScreen.video.resume(); // video obrigatorio
            }else if(screenPid) newSpeakersToThisClient.push(screenPid);            
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