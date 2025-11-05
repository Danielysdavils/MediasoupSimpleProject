const createPlainTransport = async (socket, room) => 
    new Promise(async(resolve, reject) => {
        const plainTransportParams = await socket.emitWithAck('requestPlainTransport', { room });
        console.log("PlainTransportParams: ", plainTransportParams);
    
        resolve(plainTransportParams);
});

module.exports = createPlainTransport;