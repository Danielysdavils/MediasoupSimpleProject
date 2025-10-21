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

        let newRoom = false; // (*) passar a propia sala para fornt
        let roomCreator = null; // (*)

        client = new Client(userName, socket);
        let requestedRoom = rooms.find(room => room.roomName == roomName);
        if(!requestedRoom){
            console.log("add new room");
            newRoom = true;
            roomCreator = userName;
            //make the new room, add a worker, add a router
            const workerToUse = await getWorker(workers);
            requestedRoom = new Room(roomName, client, workerToUse);
            await requestedRoom.createRouter(io);
            rooms.push(requestedRoom);
        }else
            roomCreator = requestedRoom?.creator?.userName; 

        // add the room to the client
        client.room = requestedRoom;
        // add the client to the Room clients
        client.room.addClient(client);
        // add this socket to the socket room
        socket.join(client.room.roomName);

        console.log("== CurrentProducers ==");
        console.log(client.room.currentProducers);

        //PLACEHOLDER... 6. Eventually, we will need to get all current producers
        // her will get the audioPids from currentProducers
        const audioPidsToCreate = client.room.currentProducers
            .map(p => p?.producer?.audio?.id)
            .filter(id => !!id); // remove valores undefined ou null

        console.log('audiopid: ', audioPidsToCreate);

        // find video pid and make and array with matching indices
        const videoPidsToCreate = client.room.currentProducers
            .map(p => p?.producer?.video?.id)
            .filter(id => !!id);
       
        console.log('videopid: ', videoPidsToCreate);

        const screenVideoPidsToCreate = client.room.currentProducers
            .map(p => p?.producer?.videoScreen?.id)
            .filter(id => !!id);

        console.log("screenVideoPid: ", screenVideoPidsToCreate);

        const screenAudioPidsToCreate = client.room.currentProducers
            .map(p => p?.producer?.audioScreen?.id)
            .filter(id => !!id); 

        console.log("screenAudioPids: ", screenAudioPidsToCreate);

        // find the username and make and array with matching indices
        // for audioPids/videoPids
        const associatedUserNames = client.room.currentProducers
            .map(p => p?.userName || "undefined")
            .filter(username => !!username);
        
            console.log('userNames:', associatedUserNames);

        ackCb({
            routerRtpCapabilities: client.room.router.rtpCapabilities,
            newRoom,
            roomCreator,
            audioPidsToCreate,
            videoPidsToCreate,
            screenVideoPidsToCreate,
            screenAudioPidsToCreate,
            associatedUserNames
        }) 
    });

    socket.on('requestTransport', async ({ type, audioPid, screen }, ackCb) => {
        // wheter producer or consumer, client needs params
        let clientTransportParams;
        if(type == 'producer'){
            //run a client, wiich is part of our client class
            clientTransportParams = await client.addTransport(type, null, null, null, null, screen);
        }else if(type == 'consumer'){
            console.log("No esta aqui??")
            // we have 1 tranposrt per client we are streaming from
            // each transport will have an audio and a video producer/consumer
            // we know the audioPid (beacuse it came from dominantSpeaker)
            const producingClient = client.room.clients.find(c => c?.producer?.audio?.id === audioPid);
            const videoPid = producingClient?.producer?.video?.id;
            const videoScreenPid = producingClient?.producer?.videoScreen?.id;
            const audioScreenPid = producingClient?.producer?.audioScreen?.id;

            console.log("FOR TESTING AUDIOSCREENPID: ", audioScreenPid)

            // verifica se já há transport existente para esse consumer
            const existing = client.downstreamTransport.find(t => t.associatedAudioPid === audioPid);
            if(existing){
                clientTransportParams = await client.updateTransport(audioPid, videoPid, videoScreenPid, audioScreenPid);

            }else{
                clientTransportParams = await client.addTransport(type, audioPid, videoPid, videoScreenPid, audioScreenPid);
            } 
        }

        ackCb(clientTransportParams);
    });

    socket.on('connectTransport', async ({dtlsParameters, type, audioPid, screen}, ackCb) => {
        if(type === 'producer'){
            try{
                const clientUpstream = client.upstreamTransport.find(ut => ut.screen === screen);
                await clientUpstream.transport.connect({ dtlsParameters });
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

    socket.on('startProducing', async ({ kind, rtpParameters, screen }, ackCb) => {
        // create a producer with the rtpParameters we were sent
        console.log("START PRODUCING FOR SCREEN FOR KIND: ", kind, "and screen? ", screen);
        try{
            const clientUpstream = client.upstreamTransport.find(ut => ut.screen == screen);
            const newProducer = await clientUpstream.transport.produce({kind, rtpParameters});

            // add the producer to this clien object
            client.addProducer(kind, newProducer, screen);

            if(kind === 'audio'){
                //client.room.activeSpeakerList.push(newProducer.id);
                // nao mais activeSpeakerList, mudamos para currentProducers com clients produtores
                // aqui precisamos adicionar nosso criador da sala, que não é adicionado em requestPromote
                // estou usando userName para diferenciar, (*) mudar para id
                const alreadyProducing = client.room.currentProducers.some(p => p?.userName === client.userName);
                if(!alreadyProducing){
                    client.room.currentProducers.push(client); 
                }
            }

            console.log(client.producer)
            // the front end is waiting for the id
            console.log("ending createProducerTransport!");
            ackCb(newProducer.id);
        }catch(err){
            console.log(err);
            ackCb(err)
        }
        
        console.log("UPDATING ACTIVE SPEAKERS");
        
        // run updateActiveSpeaker
        const newTransportByPeer = updateActiveSpeaker(client.room, io);
        // newTransportByPeer is an object, each property is a socket.id that
        // has transports to make. They are in an array, by pid
        for(const [socketId, audioPidsToCreate] of Object.entries(newTransportByPeer)){
            console.log("PIDS TO CREATE", audioPidsToCreate);
            // we have the audioPidsToCreate this socket needs to create
            // map the video pids and the username
            const videoPidsToCreate = audioPidsToCreate.map(aPid => {
                const producerClient = client.room.clients.find(c => c?.producer?.audio?.id === aPid);
                return producerClient?.producer?.video?.id;
            });

            const screenVideoPidsToCreate = audioPidsToCreate.map(aPid => {
                const producerClient = client.room.clients.find(c => c?.producer?.audio?.id === aPid);
                return producerClient?.producer?.videoScreen?.id;
            })

            const screenAudioPidsToCreate = audioPidsToCreate.map(aPid => {
                const producerClient = client.room.clients.find(c => c?.producer?.audio?.id === aPid);
                return producerClient?.producer?.audioScreen?.id;
            })

            const associatedUserNames = audioPidsToCreate.map(aPid => {
                const producerClient = client.room.clients.find(c => c?.producer?.audio?.id === aPid);
                return producerClient?.userName;
            });

            io.to(socketId).emit('newProducersToConsume', {
                routerRtpCapabilities: client.room.router.rtpCapabilities,
                audioPidsToCreate,
                videoPidsToCreate,
                screenVideoPidsToCreate,
                screenAudioPidsToCreate,
                associatedUserNames,
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
                    if(kind === 'audio'){
                        return t.associatedAudioPid === pid;
                    }else if(kind === 'video'){
                        return t.associatedVideoPid === pid;
                    }else if(kind === 'videoScreen'){
                        return t.associatedVideoScreenPid === pid;
                    }else if(kind === 'audioScreen'){
                        return t.associatedAudioScreenPid === pid;
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
                console.log("==== client to debug!! ====");
                console.log("==user downstream==", client.downstreamTransport);
                
                // respond with the params
                const clientParams = {
                    producerId: pid,
                    id: newConsumer.id,
                    kind: newConsumer.kind,
                    rtpParameters: newConsumer.rtpParameters
                }

                console.log("em algn momento retorna los parametros?");
                ackCb(clientParams);
            }
        }catch(err){
            console.log(err);
            ackCb('consumeFailed')
        }
    });

    socket.on('unpauseConsumer', async({pid, kind}, ackCb) => {
        const consumerToResume = client.downstreamTransport.find(t => {
            return t?.[kind]?.producerId === pid
        });
        await consumerToResume[kind]?.resume();
        ackCb();
    });

    socket.on('requestPromotion', async(obj, ackCb) => {
        try{
            const room = client.room;
            const producers = room.currentProducers;
            const creatorName = room.creator?.userName;
            const limit = room.limitProducer;

            // Caso há espaço livre
            if (producers.length < limit) {
                producers.push(client); // Adiciona diretamente à lista
                io.to(room.roomName).emit('promoteDelta', { 
                    promoted: client.userName, 
                    denoted: null 
                });
                return;
            }

            // Caso está cheio: encontrar alguém para rebaixar
            const index = producers.findIndex(p => p?.userName && p.userName !== creatorName);

            if (index === -1) {
                console.log("Nenhum produtor disponível para rebaixar (somente o criador está na sala).");
                socket.emit('promotionDenied', { reason: 'onlyCreator' });
                return;
            }

            // Rebaixar o produtor encontrado
            const demoted = producers.splice(index, 1)[0];
            console.log("Produtor rebaixado:", demoted?.userName);

            // Pausar o envio do demoted
            if (demoted?.producer) {
                if (demoted.producer.audio) await demoted.producer.audio.pause().catch(() => {});
                if (demoted.producer.video) await demoted.producer.video.pause().catch(() => {});
            }

            // Adicionar o novo produtor (*) verificar no 'startProducing' 
            producers.push(client);

            io.to(room.roomName).emit('promoteDelta', {
                promoted: client.userName,
                demoted: demoted?.userName
            });
        }catch(err){
            console.log("Promotion failed:", err);
            socket.emit('promotionDenied', { reason: 'serverError' });
        }
    });
});

httpServer.listen(config.port);

