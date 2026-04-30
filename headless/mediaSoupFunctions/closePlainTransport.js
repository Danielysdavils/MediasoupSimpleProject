const closePlainTransport = async (socket) => {
    try{
        return await socket.emitWithAck("plain:transport:close", {})
    }catch (err){
        console.log(err);
    }
}

module.exports = closePlainTransport;