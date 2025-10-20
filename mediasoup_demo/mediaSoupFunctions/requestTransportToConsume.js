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
        const screenVideoPid = consumeData.screenVideoPidsToCreate[i]; // caso alum producer esteja compartilhando tela
        const userName = consumeData.associatedUserNames[i];

        // Aqui verifico se é criador, caso sim uso slot 0, caso nao procuro o seguinte slot
        if(!(userName in layoutStore.layoutMap)){
            console.log("CREATOR NOT HERE!");
            layoutStore.setLayoutMap(
                userName, 
                (userName === layoutStore.creatorUserName) ? 0 : layoutStore.incrementSlot()
            )
        }

        const consumerTransportParams = await socket.emitWithAck('requestTransport', {
            type: 'consumer', 
            audioPid
        });

        // verifica se já existe consumer para este audioPid (caso algum cliente existente só adicone um stream)
        let existingConsumer = consumers[audioPid];

        // se já existe reutiliza o transport
        let consumerTransport = existingConsumer?.consumerTransport;

        if(!consumerTransport){
            // aqui, se não existe, então cria tranport novo para o consumidor (audio/video/desktop)
            // expecting back transport params fot THIS audioPid. Meybe 5 times, meybe 0
            consumerTransport = createConsumerTransport(consumerTransportParams, device, socket, audioPid);
            
            // ajuste para validar caso tenhamos consumer: (*) só audio || audio e video
            const audioConsumer = audioPid ? await createConsumer(consumerTransport, audioPid, device, socket, 'audio', i) : null;
            const videoConsumer = videoPid ? await createConsumer(consumerTransport, videoPid, device, socket, 'video', i) : null;
           

            console.log("audioConsumer:", audioConsumer);
            console.log("videoConsumer:", videoConsumer);
            
            
            const tracks = [];
            if(audioConsumer?.track) tracks.push(audioConsumer.track);
            if(videoConsumer?.track) tracks.push(videoConsumer.track);
            const combineStream = new MediaStream(tracks);

            console.log("Hope this works....");
            consumers[audioPid] = {
                combineStream,
                screenStream : null,
                userName: consumeData.associatedUserNames[i],
                consumerTransport,
                audioConsumer,
                videoConsumer,
                screenVideoConsumer: null
            }

            existingConsumer = consumers[audioPid]; // ??? verificar depois
        }
        
        // caso já exista, só adiciono novo stream (desktop)
        if(screenVideoPid && !existingConsumer?.screenVideoConsumer){
            const screenVideoConsumer = await createConsumer(consumerTransport, screenVideoPid, device, socket, 'videoScreen', i);
            console.log("screenVideoConsumer: ", screenVideoConsumer);

            const screenStream = screenVideoConsumer?.track // (*) ajustar para mandar o audio tambem
                ? new MediaStream([screenVideoConsumer.track])
                : null; 

            consumers[audioPid].screenVideoConsumer = screenVideoConsumer;
            consumers[audioPid].screenStream = screenStream;
        }

        // preciso avisar que há novos consumidores
        renderLayout(consumers);
    });
}

export default requestTransportToConsume;