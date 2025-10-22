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
        console.log("consumedata ", consumeData);
        const videoPid = consumeData.videoPidsToCreate[i]; // pode ser undefined se só tiver audio!
        const screenVideoPid = consumeData.screenVideoPidsToCreate[i]; // caso alum producer esteja compartilhando tela
        const screenAuidoPid = consumeData.screenAudioPidsToCreate[i];
        const userName = consumeData.associatedUserNames[i];

        // Aqui verifico se é criador, caso sim uso slot 0, caso nao procuro o seguinte slot
        if(!(userName in layoutStore.layoutMap)){
            console.log("CREATOR NOT HERE!");
            layoutStore.setLayoutMap(
                userName, 
                (userName === layoutStore.creatorUserName) ? 0 : layoutStore.incrementSlot()
            )
        }

        // preciso chamar requestTransport para atualizar/adicionar transport's do cliente 
        const consumerTransportParams = await socket.emitWithAck('requestTransport', {
            type: 'consumer', 
            audioPid
        });

        // verifica se já existe consumer para este audioPid (caso seja algum cliente existente, só adicono o stream)
        let existingConsumer = consumers[audioPid];

        // se já existe, reutiliza o transport
        let consumerTransport = existingConsumer?.consumerTransport;

        if(!consumerTransport){
            // aqui, se não existe, então cria tranport novo para o consumidor (audio/video/desktop)
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
                screenVideoConsumer: null,
                screenAudioConsumer: null
            }

            existingConsumer = consumers[audioPid]; // ??? verificar depois
        }
        
        // aqui, caso já exista consumerTransport, só adiciona o novo stream (do desktop)
        // mas isto com algumas verificaões importantes: 
        //  - está o caso que começe a transmitir tela pela 1ra vez, então não tem screenVideoConsumer
        //  - está o caso que tenha screenVideoConsumer mas deseje mudar o existente pelo novo (nova transmissao de tela)
        //  - está o caso que o usuário tenha fechado e deseje recriar (uma vez mais, nova transmissão de tela)
        if(screenVideoPid && (
            !existingConsumer?.screenVideoConsumer || 
            existingConsumer?.screenVideoConsumer.closed || 
            existingConsumer?.screenVideoConsumer.producerId !== screenVideoPid
        )){
            const screenVideoConsumer = await createConsumer(consumerTransport, screenVideoPid, device, socket, 'videoScreen', i);
            const screenAudioConsumer = screenAuidoPid ? await createConsumer(consumerTransport, screenAuidoPid, device, socket, 'audioScreen', i) : null;
            console.log("screenVideoConsumer: ", screenVideoConsumer);

            const tracks = [];
            if(screenVideoConsumer?.track) tracks.push(screenVideoConsumer.track);
            if(screenAudioConsumer?.track) tracks.push(screenAudioConsumer.track);
            const screenStream = new MediaStream(tracks);
            
            consumers[audioPid].screenVideoConsumer = screenVideoConsumer;
            consumers[audioPid].screenAudioConsumer = screenAudioConsumer;

            consumers[audioPid].screenStream = screenStream;
        }

        // preciso avisar que há novos consumidores, ou sjea, atualizar o layout
        renderLayout(consumers);
    });
}

export default requestTransportToConsume;