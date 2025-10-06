const fs = require("fs"); //we need thist to read our keys. Part of node
const https = require("https"); //we need this for a secure express connection
const http = require("http");

//express sets up the http server and servers our front end
const express = require("express");
const app = express();
//save everythinh in public statically
app.use(express.static('public'));

//get the keys we made with mkcert
const key = fs.readFileSync('./config/cert.key')
const cert = fs.readFileSync('./config/cert.crt')
const options = { key, cert }

//use those keys with the https module to have https
const socketio = require("socket.io");
//const httpServer = https.createServer(options, app); //for https, instalar certificados!!!
const httpServer = http.createServer(app);

const mediasoup = require("mediasoup");
const config = require("./config/config");

const updateActiveSpeaker = require("./utilities/updateActiveSpeakers")

//classes
const Client = require("./classes/Client")
const Room = require("./classes/Room")

const createWorkers = require("./utilities/createWorkers");
const getWorker = require("./utilities/getWorker")

//set up the socketio server, listening by way of our express httpServer
const io = socketio(httpServer, {
    cors: {
        origin: "*",        // permite qualquer origem
        methods: ["GET", "POST"], // métodos liberados
        allowedHeaders: ["*"],    // libera qualquer header
        credentials: true
    }
});

//init workers, it's where out mediasoup workers will live
let workers = null;
// router is now managed by the Room object
// master rooms array that contains all our Room object
const rooms = [];

//initMediaSoup gets mediasoup ready to do its thing
const initMediaSoup = async () => {
    workers = await createWorkers();
    //console.log(workers);
}

initMediaSoup() // build our mediasoup server/sfu

// socketIo listeners
io.on('connect', socket => { 
    //this is where this client/user/socket lives!
    console.log("connected");
    let client; //this client object available to all out socjet listeners
    //add some cookies for reload when user disconnect! add lather
    const handshake = socket.handshake // socket.hanhake is where auth and query live
    // check handshake for password, auth, etc // api?
    socket.on('joinRoom', async (obj, ackCb) => {
        let userName = obj.user;
        let roomName = obj.room;

        let newRoom = false;
        client = new Client(userName, socket);
        let requestedRoom = rooms.find(room => room.roomName == roomName);
        if(!requestedRoom){
            console.log("add new room");
            newRoom = true;
            //make the new room, add a worker, add a router
            const workerToUse = await getWorker(workers);
            requestedRoom = new Room(roomName, workerToUse);
            await requestedRoom.createRouter(io);
            rooms.push(requestedRoom);
        }
        // add the room to the client
        client.room = requestedRoom;
        // add the client to the Room clients
        client.room.addClient(client);
        // add this socket to the socket room
        socket.join(client.room.roomName);

        //PLACEHOLDER... 6. Eventually, we will need to get all current producers
        //fetch de first 0-5 pids in activeSpeakerList
        const audioPidsToCreate = client.room.activeSpeakerList.slice(0, 5);
        console.log('audiopid: ', audioPidsToCreate);

        // find video pid and make and array with matching indices
        const videoPidsToCreate = audioPidsToCreate.map(aid => {
            const producingClient = client.room.clients.find(c => c?.producer?.audio?.id === aid);
            return producingClient?.producer?.video?.id;
        });
        console.log('videopid: ', videoPidsToCreate);

        // find the username and make and array with matching indices
        // for audioPids/videoPids
        const associatedUserNames = audioPidsToCreate.map(aid => {
            const producingClient = client.room.clients.find(c => c?.producer?.audio?.id === aid);
            return producingClient?.userName; 
        });

        ackCb({
            routerRtpCapabilities: client.room.router.rtpCapabilities,
            newRoom,
            audioPidsToCreate,
            videoPidsToCreate,
            associatedUserNames
        }) 
    });

    socket.on('requestTransport', async ({ type, audioPid }, ackCb) => {
        // wheter producer or consumer, client needs params
        let clientTransportParams;
        if(type == 'producer'){
            //run a client, wiich is part of our client class
            clientTransportParams = await client.addTransport(type);
        }else if(type == 'consumer'){
            // we have 1 tranposrt per client we are streaming from
            // each transport will have an audio and a video producer/consumer
            // we know the audioPid (beacuse it came from dominantSpeaker)
            const producingClient = client.room.clients.find(c => c?.producer?.audio?.id === audioPid);
            const videoPid = producingClient?.producer?.video?.id;
            clientTransportParams = await client.addTransport(type, audioPid, videoPid);
        }

        ackCb(clientTransportParams);
    });

    socket.on('connectTransport', async ({dtlsParameters, type, audioPid}, ackCb) => {
        if(type === 'producer'){
            try{
                await client.upstreamTransport.connect({ dtlsParameters });
                ackCb('success');
            }catch(err){
                console.log(err + "in connectTransport");
                ackCb('error');
            }
        }else if(type === 'consumer'){
            // find the right transport for this consumer
            try{
                const downstreamTransport = client.downstreamTransport.find(t => {
                    return t.associatedAudioPid === audioPid
                });

                downstreamTransport.transport.connect({dtlsParameters})
                ackCb("success");
            }catch(err){
                console.log(err)
                ackCb("error")
            }
        }
    });

    socket.on('startProducing', async ({ kind, rtpParameters }, ackCb) => {
        // create a producer with the rtpParameters we were sent
        try{
            const newProducer = await client.upstreamTransport.produce({kind, rtpParameters});
            // add the producer to this clien object
            client.addProducer(kind, newProducer);
            if(kind === 'audio'){
                client.room.activeSpeakerList.push(newProducer.id);
            }
            // the front end is waiting for the id
            ackCb(newProducer.id);
        }catch(err){
            console.log(err);
            ackCb(err)
        }

        // PLACEHOLDER 1- if this is an audiotrack, then this is a new posible speaker
        // PLACEHOLDER 2 - if the room is populated, then let the connected peers knows someone joins

        // run updateActiveSpeaker
        const newTransportByPeer = updateActiveSpeaker(client.room, io);
        // newTransportByPeer is an object, each property is a socket.id that
        // has transports to make. They are in an array, by pid
        for(const [socketId, audioPidsToCreate] of Object.entries(newTransportByPeer)){
            // we have the audioPidsToCreate this socket needs to create
            // map the video pids and the username
            const videoPidsToCreate = audioPidsToCreate.map(aPid => {
                const producerClient = client.room.clients.find(c => c?.producer?.audio?.id === aPid);
                return producerClient?.producer?.video?.id;
            });

            const associatedUserNames = audioPidsToCreate.map(aPid => {
                const producerClient = client.room.clients.find(c => c?.producer?.audio?.id === aPid);
                return producerClient?.userName;
            });

            io.to(socketId).emit('newProducersToConsume', {
                routerRtpCapabilities: client.room.router.rtpCapabilities,
                audioPidsToCreate,
                videoPidsToCreate,
                associatedUserNames,
                activeSpeakerList: client.room.activeSpeakerList.slice(0, 5)
            });
        }
    });

    socket.on('audioChange', typeOfChange => {
        if(typeOfChange === "mute"){
            client?.producer?.audio?.pause();
        }else{
            client?.producer?.audio?.resume();
        }
    });

    socket.on('consumeMedia', async ({rtpCapabilities, pid, kind}, ackCb) => {
        // will run twice for every peer to consume .. once for video, one for audio
        console.log("kind: ", kind, "  pid", pid);
        // we will set up clientConsumer, and send back the param
        // use the right transport and add/update the consumer client
        // confirm canConsume
        try{
            if(!client.room.router.canConsume({producerId: pid, rtpCapabilities})){
                ackCb('cannotConsume')
            }else{
                // we can consume!!
                const downStreamTransport = client.downstreamTransport.find(t => {
                    if(kind == 'audio'){
                        return t.associatedAudioPid === pid;
                    }else if(kind === 'video'){
                        return t.associatedVideoPid === pid;
                    }
                })

                if(!downStreamTransport){
                    console.log("NO DOWNSTREAM TRANSPORT FOUND FOR ", kind, "and pid", pid);
                    return ackCb('noTransport')
                }

                // create the consumer the transport
                const newConsumer = await downStreamTransport.transport.consume({
                    producerId: pid,
                    rtpCapabilities,
                    paused: true
                });
                
                // add this newConsumer to the client
                client.addConsumer(kind, newConsumer, downStreamTransport);
                // respond with the params
                const clientParams = {
                    producerId: pid,
                    id: newConsumer.id,
                    kind: newConsumer.kind,
                    rtpParameters: newConsumer.rtpParameters
                }

                ackCb(clientParams);
            }
        }catch(err){
            console.log(err);
            ackCb('consumeFailed')
        }
    });

    socket.on('unpauseConsumer', async({pid, kind}, ackCb) => {
        const consumerToResume = client.downstreamTransport.find(t => {
            return t?.[kind].producerId === pid
        });
        await consumerToResume[kind].resume();
        ackCb();
    })
});

httpServer.listen(config.port);

