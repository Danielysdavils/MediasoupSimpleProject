const closeRoom = async (socket) => {
    return new Promise(async(resolve, reject) => {
        try{
            socket.emit("leaveRoom", {reason: 'creatorLeft'});
            resolve('success');
        }catch(err){
            console.log(err)
            resolve(err)
        }
    });
}


module.exports = closeRoom;