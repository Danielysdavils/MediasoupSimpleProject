const closeProducerTransport = async (socket) => {
    try{
        return await socket.emitWithAck("producer:close", {});
    }catch(err){
        console.log(err);
    }
}


module.exports = closeProducerTransport;