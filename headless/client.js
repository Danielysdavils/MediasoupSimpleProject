/*

    HEADLESS - create a plainTransport for ffmpeg injection into mediasoup server
    Version: v0.0.1

*/

const SessionManager = require("./classes/SessionManager");

const serverUrl = "http://localhost:3031";

const manager = new SessionManager(serverUrl);

const sessionsForTest = [
    {
        id: 1,
        name: 'session1',
        creator: 'lin',
        startDateTime: new Date('2025', '11', '10', '23', '55'),
        endDateTime: new Date('2025', '11', '10', '23', '10'),
        files: [
            {fullPath: 'C:\Users\mtw\Downloads\sfu\mediasoup\copy-mediasoupProject\MediasoupSimpleProject\headless\video\video1.mp4'},
            {fullPath: 'C:\Users\mtw\Downloads\sfu\mediasoup\copy-mediasoupProject\MediasoupSimpleProject\headless\video\Is Civilization on the Brink of Collapse.mp4'},
            {fullPath: `C:\Users\mtw\Downloads\sfu\mediasoup\copy-mediasoupProject\MediasoupSimpleProject\headless\video\Black Hole's Evil Twin - Gravastars Explained.mp4`}
        ]
    }
]

async function startHeadless(){
    console.log("Starting Headless software!");

    if(!sessionsForTest.length) console.log("Nenhuma sessão para reproduzir!");

    sessionsForTest.forEach(session => {
        manager.addSession(session);
    });
}

startHeadless().catch(console.error);








