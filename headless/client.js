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
        startDateTime: new Date('2025', '11', '02', '17', '42'),
        endDateTime: new Date('2025', '11', '02', '20', '49'),
        files: [
            {fullPath: `C:/Users/mtw/Downloads/sfu/mediasoup/copy-mediasoupProject/MediasoupSimpleProject/headless/video/video7.mp4`},
            {fullPath: `C:/Users/mtw/Downloads/sfu/mediasoup/copy-mediasoupProject/MediasoupSimpleProject/headless/video/video8.mp4`},
            {fullPath: `C:/Users/mtw/Downloads/sfu/mediasoup/copy-mediasoupProject/MediasoupSimpleProject/headless/video/video3.mp4`},
        ]
    },
    {
        id: 2,
        name: 'session2',
        creator: 'lin',
        startDateTime: new Date('2025', '11', '02', '17', '43'),
        endDateTime: new Date('2025', '11', '02', '20', '49'),
        files: [
            {fullPath: `C:/Users/mtw/Downloads/sfu/mediasoup/copy-mediasoupProject/MediasoupSimpleProject/headless/video/video4.mp4`},
            {fullPath: `C:/Users/mtw/Downloads/sfu/mediasoup/copy-mediasoupProject/MediasoupSimpleProject/headless/video/video5.mp4`},
            {fullPath: `C:/Users/mtw/Downloads/sfu/mediasoup/copy-mediasoupProject/MediasoupSimpleProject/headless/video/video6.mkv`},
        ]
    },
    {
        id: 3,
        name: 'session3',
        creator: 'lin1',
        startDateTime: new Date('2025', '11', '02', '18', '30'),
        endDateTime: new Date('2025', '11', '02', '20', '49'),
        files: [
            {fullPath: `C:/Users/mtw/Downloads/sfu/mediasoup/copy-mediasoupProject/MediasoupSimpleProject/headless/video/video1.mp4`},
            {fullPath: `C:/Users/mtw/Downloads/sfu/mediasoup/copy-mediasoupProject/MediasoupSimpleProject/headless/video/video2.mp4`},
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








