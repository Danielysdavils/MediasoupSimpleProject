const cleanupClient = require("./cleanupClient");

const deleteRoom = (roomName, io, rooms) => {
    console.log("=== rooms === ", rooms);

    const roomIndex = rooms.findIndex(r => r.roomName === roomName);
    if(roomIndex === -1) return;

    const roomToDelete = rooms[roomIndex];
    console.log(`Deletando room ${roomName}`);

    for(const client of roomToDelete.clients){
        let isProducer = false;
        let audioPid = null;
        
        // todo producer tem ao menos audio
        if(client.producer?.audio){
            isProducer = true;
            audioPid = client.producer?.audio?.id;
        }
        
        // limpa cliente 
        cleanupClient(client);

        // limpa os currentProducers
        let index = client.room.currentProducers.findIndex(cp => cp.socket.id === client.socket.id);
        if(index !== -1){
            client.room.currentProducers.splice(index, 1);
        }

        // notifica os peers se é producer
        if(isProducer && audioPid){
            console.log("emitindo para outros!");
            io.to(roomToDelete.roomName).emit("peerLeft", { audioPid, clientName: client.userName });
        }

        // desconeta socket
        try { client.socket.disconnect(true); } catch(err) { console.log(err); }
    }

    rooms.splice(roomIndex, 1);
}

module.exports = deleteRoom;