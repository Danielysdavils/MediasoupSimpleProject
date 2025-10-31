const cleanupClient = (client) => {
    console.log(`Cleanup client ${client.userName}`);

    // fecha todos os producers, lembrando q producers é um objeto {[kind]: {}}
    if(client.producer){
        for(const key of Object.keys(client.producer)){
            const p = client.producer[key];
            if(!p.closed){
                try{
                    p.close();
                    console.log(`Producer ${key} fechado!`);
                }catch(err){
                    console.log(`Erro ao fechar producer ${key}: `, err);
                }
            }
        }
    }

    // fecha os transport do producer
    if(Array.isArray(client.upstreamTransport)){
        for(const up of client.upstreamTransport){
            console.log("UPDSTREAM TO DELETE: ", up.screen);
            if(up.transport){
                try{
                    up.transport.close();
                    console.log("tranpsort do upstream fechado!");
                }catch(err){
                    console.log("erro ao fechar transport do updstream");
                }
            }
        }
    }
    
    // fecha todos os transport's dos downstreams do cliente
    // e fecha os producers existentes (mic/v/desktop/desktop audio) dos downstreams tmb 
    if(Array.isArray(client.downstreamTransport)){
        for(const d of client.downstreamTransport){
            console.log("DOWNSTREAM TO DELETE: ", d);
            for(const type of ["audio", "video", "audioScreen", "videoScreen"]){
                const producer = d[type];
                if(producer){
                    try{
                        producer.close();
                        console.log(`Producer ${type} do downstream fechado!`);
                    }catch(err){
                        console.log(`Producer ${type} do downstream retornou erro ao fechar!`);
                    }
                }
            }

            if(d.transport){
                try{
                    d.transport.close();
                    console.log("transport do downstream fechado!");
                }catch(err){
                    console.log("Erro ao fechar downstream transport: ", err);
                }
            }
        }
    }
}

module.exports = cleanupClient;