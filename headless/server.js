/*
    gRPC SERVER - receive all sessions from gRPC channel in C#
    Version: v0.0.1
    Creator: Danielys Davila
*/

const grpc = require("@grpc/grpc-js")
const protoLoader =  require("@grpc/proto-loader")
const path = require("path")
const SessionManager = require("./classes/SessionManager")

const PROTO_PATH = path.join(__dirname, 'proto', 'sessions.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const proto = grpc.loadPackageDefinition(packageDef).sessions;

const PORT = process.env.GRPC_PORT || "0.0.0.0:50051";

const serverUrl = "http://localhost:3031";

const manager = new SessionManager(serverUrl);

async function StreamSessions(call){
    console.log('[server] Novo stream conectado do cliente gRPC');
    
    let inFlight = 0;
    const MAX_INFLIGHT = 2000;

    call.on("data", (session) => {
        
        if(inFlight > MAX_INFLIGHT){
            console.log("inFlight alto: ", inFlight);
            call.Write({
                id: session.id,
                accepted: false,
                reason: "server.overloaded"
            });
            return;
        }

        inFlight++;

        try{
            const sessionObj = {
                id: session.id,
                startDateTime: session.startDateTime,
                endDateTime: session.endDateTime,
                creator: session.creator,
                files: session.files,
                fileOrder: session.fileOrder
            }

            console.log(`[server] message received ${sessionObj.files}`);
         
            manager.addSession(sessionObj);

            call.write({ 
                id: sessionObj.id, 
                accepted: true, 
                reason: '' 
            });
        
        }catch(err){
            console.error("Erro ao processar sessao: ", err);

            call.write({ 
                id: session.id || '', 
                accepted: false, 
                reason: String(err) 
            });
        
        }finally{
            inFlight--;
        }
    });

    call.on('end', () => {
        console.log("Cliente encerrou o stream!");
        call.end();
    });

    call.on('error', (err) => {
        console.log("Erro no stream gRPC: ", err);
    });

    call.on('cancelled', () => {
        console.log("Stream cancelado pelo cliente");
    });
}

function main(){
    const server = new grpc.Server({
        // add some propertys
    });

    server.addService(proto.SessionService.service, { StreamSessions });
    server.bindAsync(PORT, grpc.ServerCredentials.createInsecure(), (err, port) => {
        if(err){
            console.log("Erro bind gRPC: ", err);
            return;
        }
        server.start();
        console.log(`gRPC server ouvindo em ${PORT}`);
    });
}

if(require.main == module) main();

module.exports = { main };

