/*
    HEADLESS - create a plainTransport for ffmpeg injection into mediasoup server
    Version: v0.0.1
    creator: Danielys Davila
*/

const server = require('./server')

async function startHeadless(){
    console.log("Starting Headless software");
    // init gRPC server
    server.main();
}

startHeadless().catch(err => {
    console.error("Error ao iniciar: ", err);
    process.exit(1);
});








