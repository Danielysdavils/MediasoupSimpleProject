const config = require("../config/config")
//const newDominantSpeaker = require("../utilities/newDominantSpeaker")

// Rooms are not a Mediasoup thing. Ms cares about mediastreams, transports, 
// things like that. It doesn't care, or know, about rooms.
// Rooms can be inside of clients, clients inside of rooms,
// tranport can belong to rooms or clients, etc.

class Room{
    constructor(roomName, creator, workerToUse){
        this.roomName = roomName;
        this.worker = workerToUse;
        this.router = null;
        this.creator = creator; // client who creates the room
        this.limitProducer = 2; // max producers (sending a/v) in a room
        this.currentProducers = [] // current producers in a room (*) i will count creator?? yes
        this.clients = []; // clients in this room
        // an array of id's with the most recent dominant speaker firts
        //this.activeSpeakerList = [];
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

            //Não vou usar pq vou fazer manual o gerenciamento de dominantSpeaker: criador da sala
            // this.activeSpeakerObserver = await this.router.createActiveSpeakerObserver({
            //     interval: 300 // 300 is default
            // });

            // this.activeSpeakerObserver.on('dominantspeaker', ds => newDominantSpeaker(ds, this, io));
            resolve();
        })  
    }
}

module.exports = Room;