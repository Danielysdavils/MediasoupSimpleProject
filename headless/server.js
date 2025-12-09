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

function timestampToDate(ts){
    if(!ts) return null;
    const seconds = Number(ts.seconds || 0);
    const nanos = Number(ts.nanos || 0);
    return new Date(seconds * 100 + Math.round(nanos / 1e6));
}

async function StreamSessions(call){
    console.log('Novo stream conectado do cliente gRPC');
    
    let inFlight = 0;
    const MAX_INFLIGHT = 2000;

    call.on("data", (session) => {
        inFlight++;
        try{
            const sessionObj = {
                id: session.id,
                startDateTime: timestampToDate(session.startDateTime),
                endDateTime: timestampToDate(session.endDateTime),
                creator: session.creator,
                files: session.files,
                file_order: session.file_order
            }

            manager.addSession(sessionObj);
            const ack = {id: sessionObj.id, accepted: true, reason: ''};
            const ok = call.write(ack);
            if(!ok){
                // ADD SOME ERROR TREATMENT
            }
        
        }catch(err){
            console.error("Erro ao processar sessao: ", err);
            const ack = { id: session.id || '', accepted: false, reason: String(err) };
            call.write(ack);
        
        }finally{
            inFlight = Math.max(0, inFlight - 1);
        }

        if(inFlight > MAX_INFLIGHT){
            console.log("inFlight alto: ", inFlight);
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
    })
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

