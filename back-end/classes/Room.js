const config = require("../config/config")
const newDominantSpeaker = require("../utilities/newDominantSpeaker")

// Rooms are not a Mediasoup thing. Ms cares about mediastreams, transports, 
// things like that. It doesn't care, or know, about rooms.
// Rooms can be inside of clients, clients inside of rooms,
// tranport can belong to rooms or clients, etc.

class Room{
    constructor(roomName, workerToUse){
        this.roomName = roomName;
        this.worker = workerToUse;
        this.router = null;
        this.clients = []; // clients in this room
        // an array of id's with the most recent dominant speaker firts
        this.activeSpeakerList = [];
        //this.activeSpeakerObserver = null;
    }

    addClient(client){
        this.clients.push(client)
    }

    async createRouter(io){
        return new Promise(async (resolve, reject) => {
            this.router = await this.worker.createRouter({
                mediaCodecs: config.routerMediaCodecs
            });

            this.activeSpeakerObserver = await this.router.createActiveSpeakerObserver({
                interval: 300 // 300 is default
            });

            this.activeSpeakerObserver.on('dominantspeaker', ds => newDominantSpeaker(ds, this, io));
            resolve();
        })  
    }
}

module.exports = Room;