import createConsumerTransport from "../mediaSoupFunctions/createConsumerTransport";
import createConsumer from "../mediaSoupFunctions/createConsumer";
import renderLayout from "../layoutFunctions/renderLayout";

import { useLayoutStore } from "@/stores/layout";



const requestTransportToConsume = (consumeData, socket, device, consumers) => {
    const layoutStore = useLayoutStore()
/*
    How many transport? One for each consumer?
    Or one that handles all consumers?
        if we do one for every consumer, it will mean can do
        POSITIVE: more fine grained networking control
            it also means if one transport is lost or unsteable,
            the others are ok
        NEGATIVE: But it's confusing!
        if we have one transport and all the consumers use it,
            POSITIVE: this makes our code much easier to manage
            and is potentially more efficient for the server
            NEGATIVE: we have no fine control and a single point of failure
        This means every peer has an upstream transport and a 
        downstream one, so the server will have 2n transports open,
        where n is te number of peers
*/
    consumeData.audioPidsToCreate.forEach(async(audioPid, i) => {
        const videoPid = consumeData.videoPidsToCreate[i]; // pode ser undefined se só tiver audio!
        const userName = consumeData.associatedUserNames[i]

        // Aqui verifico se é criador, caso sim uso slot 0, caso nao procuro o seguinte slot
        if(!(userName in layoutStore.layoutMap)){
            console.log("CREATOR NOT HERE!");
            layoutStore.setLayoutMap(userName, (userName === layoutStore.creatorUserName) ? 0 : layoutStore.incrementSlot())
        }

        // expecting back transport params fot THIS audioPid. Meybe 5 times, meybe 0
        const consumerTransportParams = await socket.emitWithAck('requestTransport', {
            type: 'consumer', 
            audioPid
        });

        console.log("Consumer transport params: ", consumerTransportParams);

        const consumerTransport = createConsumerTransport(consumerTransportParams, device, socket, audioPid);
        // const [ audioConsumer, videoConsumer ] = await Promise.all([
        //     createConsumer(consumerTransport, audioPid, device, socket, 'audio', i),
        //     createConsumer(consumerTransport, videoPid, device, socket, 'video', i),
        // ]);

        // ajuste para validar caso tenhamos consumer: (*) só audio || audio e video
        const audioConsumer = audioPid ? await createConsumer(consumerTransport, audioPid, device, socket, 'audio', i) : null;
        const videoConsumer = videoPid ? await createConsumer(consumerTransport, videoPid, device, socket, 'video', i) : null;

        console.log("audioConsumer:", audioConsumer);
        console.log("videoConsumer:", videoConsumer);
        // create a new mediaStream on the client with both tracks
        // this is why we have gonna through all this pain!!
        // const combineStream = new MediaStream([audioConsumer?.track, videoConsumer?.track]); // ajustado para considerar (*)
        const tracks = [];
        if(audioConsumer?.track) tracks.push(audioConsumer.track);
        if(videoConsumer?.track) tracks.push(videoConsumer.track);
        const combineStream = new MediaStream(tracks);

        // const remoteVideo = document.getElementById(`remote-video-${i}`);
        // if(remoteVideo && combineStream.getTracks().length > 0)
        //     remoteVideo.srcObject = combineStream;

        // const remoteVideoUserName = document.getElementById(`username-${i}`);
        // if(remoteVideoUserName)
        //     remoteVideoUserName.innerHTML = consumeData.associatedUserNames[i] || "Unknown";

        console.log("Hope this works....");
        consumers[audioPid] = {
            combineStream,
            userName: consumeData.associatedUserNames[i],
            consumerTransport,
            audioConsumer,
            videoConsumer
        }

        // preciso avisar que há novos consumidores
        renderLayout(consumers);
    })
}

export default requestTransportToConsume;