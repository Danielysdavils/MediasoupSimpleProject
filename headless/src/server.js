/*
    gRPC SERVER - receive all sessions from gRPC channel in C#
    Version: v0.0.1
    Creator: Danielys Davila
*/

const grpc = require("@grpc/grpc-js")
const protoLoader =  require("@grpc/proto-loader")
const path = require("path")
const SessionManager = require("../classes/SessionManager")

const PROTO_PATH = path.join(__dirname, '../proto', 'sessions.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const proto = grpc.loadPackageDefinition(packageDef).sessions;

const PORT = process.env.GRPC_PORT || "127.0.0.1:50051";

// (!) para teste local
//const serverUrl = "https://siris.local:3031";

// para deploy servidor desenvolvimento
const serverUrl = "https://siris.dyndns.org";

const manager = new SessionManager(serverUrl);

let shuttingDown = false;

async function StreamSessions(call){
    console.log('[server] Novo stream conectado do cliente gRPC');
    
    let inFlight = 0;
    const MAX_INFLIGHT = 2000;

    call.on("data", (eventSession) => {
        console.log(eventSession);
        const sessionId = eventSession?.id ?? '';

        console.log(`[server] Evento recebido para sessão ${sessionId}`, eventSession);
        
        if(inFlight > MAX_INFLIGHT){
            console.log("inFlight alto: ", inFlight);

            call.Write({
                id: sessionId,
                accepted: false,
                reason: "server.overloaded"
            });
            return;
        }

        inFlight++;

        try{
            if(!sessionId) throw new Error("missing.session.id");

            const version = Number(eventSession.version ?? 0);

            if(!manager.acceptVersion(sessionId, version)){
                call.write({
                    id: sessionId,
                    accepted: false,
                    reason: "stale.event"
                });
                return;
            }

            /**
             * EVENTO: NOVA SESSÃO ENTRANDO
             */
            if(eventSession.created){
                const sessionObj = normalizeGrpcSessions(sessionId, eventSession.created.full);
                console.log(
                    `[server] CREATED recebido para sessão ${sessionId}. Files=${sessionObj.files.length}`
                );
                manager.addSession(sessionObj);
            }


            /**
             * EVENTO: SESSÃO PARA ATUALIZAR
             */
            else if(eventSession.updated){
                const sessionObj = normalizeGrpcSessions(sessionId, eventSession.updated.full);
                console.log(
                    `[server] UPDATED recebido para sessão ${sessionId}. Files=${sessionObj.files.length}`
                );
                manager.updateSession(sessionId, sessionObj);
            }

            /**
             * EVENTO: SESSÃO A DELETAR
             *  -> Só precisa do id da sessão
             */
            else if(eventSession.deleted){
                console.log(
                    `[server] DELETED recebido para sessão ${sessionId}`
                );

                manager.cancelSession(sessionId);
            }

            else{
                throw new Error("unknown.session.event");
            }

            call.write({ 
                id: sessionId, 
                accepted: true, 
                reason: '' 
            });
        
        }catch(err){
            console.error("Erro ao processar sessao: ", err);

            call.write({ 
                id: sessionId, 
                accepted: false, 
                reason: String(err?.message ?? err) 
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
            console.error("[Headless] Erro bind gRPC:", err);
            process.exit(1);
        }

        server.start();
        console.log(`gRPC server ouvindo em ${PORT}`);
    });

    process.on("SIGINT", () => {
        console.log("[Headless] SIGINT recebido. Encerrando gRPC...");
        shutdown(server, "SIGINT");
    });

    process.on("SIGTERM", () => {
        console.log("[Headless] SIGTERM recebido. Encerrando gRPC...");
        shutdown(server, "SIGTERM");
    });
}

/*
    SAFE SHUTDOWN - Close all gRPC/ffmpeg/mediasoup open process
*/
async function shutdown(server, signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`[Headless] ${signal} recebido. Encerrando headless...`);

    try {    
        await shutdownGrpcServer(server, 5000);

        console.log("[Headless] gRPC encerrado com sucesso.");
        process.exit(0);
    } catch (err) {
        console.error("[Headless] Erro durante shutdown:", err);
        process.exit(1);
    }
}

function shutdownGrpcServer(server, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        let finished = false;

        const timer = setTimeout(() => {
            if (finished) return;

            finished = true;

            console.warn(
                "[Headless] gRPC não encerrou graciosamente. Forçando shutdown..."
            );

            try {
                server.forceShutdown();
                resolve();
            } catch (err) {
                reject(err);
            }
        }, timeoutMs);

        server.tryShutdown((err) => {
            if (finished) return;

            finished = true;
            clearTimeout(timer);

            if (err) {
                reject(err);
                return;
            }

            resolve();
        });
    });
}

function normalizeGrpcSessions(sessionId, grpcSession){
    return {
        id: sessionId,
        name: grpcSession.name,
        creator: grpcSession.creator,
        startDateTime: grpcSession.startDateTime,
        endDateTime: grpcSession.endDateTime,
        files: grpcSession.files ?? []
    };
}

if(require.main == module) main();

module.exports = { main };

