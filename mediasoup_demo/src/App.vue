<template>
  <section class="container">
    <section style="height: 20%">
      <div id="room-info">
			  Room: <input id="room-input" placeholder="Room Name" v-model="roomId" type="text" />
			  User:<input id="username" v-model="user" type="text" />
			  <button @click="joinRoom" ref="join-room">Join</button>
        <button @click="leaveRoom" ref="leave-room" disabled>Leave</button>
	  	</div>

		  <!-- Buttons that setup the call/control feed -->
	    <div id="control-buttons" class="d-none" style="display:flex; align-items: center;" v-if="show_controls">
        <section style="display: flex;">
          <h4>enable audio</h4>
          <input type="checkbox" name="checkboxAudio" class="checbox-input" v-model="audioEnable" />
          <h4>enable video</h4>
          <input type="checkbox" name="checkboxVideo" class="checbox-input" v-model="videoEnable" />
        </section>
        <div v-if="!newRoom">
          <button ref="enable-feed" @click="requestPromotion" class="btn btn-primary">Question?</button>
        </div>
        <div v-else>
          <button ref="start-feed" @click="startFeed" class="btn btn-primary">Start Transmission</button>
        </div>
        <h4 ref="state-feed" class="btn btn-success">OFF</h4>
		    <button ref="mute" @click="muteAudio" class="btn btn-success" disabled>Audio On</button>
        <button ref="mute-camera" @click="muteCamera" class="btn btn-success" disabled>Camera On</button>
        <button ref="screenEnable" @click="enableScreenSharing" class="btn btn-success" disabled>ScreenSharing</button>
        <button ref="screenStop" @click="stopScreenSharing" class="btn btn-success" disabled>Stop ScreenSharing</button>
		  </div>
    </section>

		<!-- Small videos at top (non dominant speaker) -->
		<section style="height: 50%;">
      <div id="remote-media" style="display:flex;align-items: center;justify-content: center;">
        <div class="remote-video-container border border-primary remote-speaker" style="width:20%">
          <video ref="remote-video-1" id="remote-video-1" class="w-100 h-100 remote-video" autoplay inline></video>
          <div ref="username-1" id="username-1" class="username"></div>
        </div>
      </div> 
    </section>
	
		<!-- Current Speaker Video (Large Center Video) -->
		<section style="height: 30%; margin-top:10px;">
      <h2>Dominant Speaker</h2>
      <div id="current-speaker" style="text-align: center;">
        <div class="current-video-container" style="width: 100%; margin: 10;">
          <div style="display:flex; height: 400px;">
            <video style="width:100%; height:100%" id="remote-video-0" class="w-100 h-100 border border-primary remote-video" autoplay inline></video>
            <video style="width:100%; height:100%" id="remoteScreen-video-0" class="w-100 h-100 border border-primary remote-video" autoplay inline></video>
          </div>
          <div id="username-0" class="username"></div>
        </div>
		  </div>
	
      <!-- Local Media Section (bottom left corner) -->
      <div id="local-media" class="position-relative" style="height: 150px; margin-top:20px;">
        <!-- Local Video Stream: whats the clients are seeing on the Left -->
        <div class="position-absolute">
          <video ref="local-video-left" class="local-video-left" style="border: black 1px solid; height: 100%" muted autoplay inline></video>
        </div>
        <h3>local video</h3>
      </div>
    </section>
  </section>
</template>

<script setup>
  import { io } from 'socket.io-client'
  import { Device } from 'mediasoup-client'
  import { ref, useTemplateRef, nextTick } from 'vue'
  import createProduceTransport from '../mediaSoupFunctions/createProducerTranposrt';
  import createProducer from '../mediaSoupFunctions/createProducer';
  import requestTransportToConsume from '../mediaSoupFunctions/requestTransportToConsume';
  import { useLayoutStore } from './stores/layout';

  const layoutStore = useLayoutStore();

  // ========= GLOBAL VARIABLES ======== //

  let device = null; // mediasoup device client
  let consumers = {} // currents consumers of the room. [audioPid]:{ .. }
  let localStream = null; // webcam video/mic audio
  let localScreenSharing = null; // desktop video/desktop audio
  
  // USER AND ROOM CLASS
  const user = ref("");
  const roomId = ref("");
  const newRoom = ref(false);
  let isProducer = ref(false);
  let isCreator = ref(false);

  // FRONT BUTTONS
  const show_controls = ref(false);
  const leave_button = useTemplateRef("leave-room");
  const join_button = useTemplateRef("join-room");
  const videoLeft_button = useTemplateRef("local-video-left"); // para o localStream
  const mute_button = useTemplateRef("mute");
  const mutecamera_button = useTemplateRef("mute-camera");
  const state_feed = useTemplateRef("state-feed"); // ON/OFF
  const start_feed = useTemplateRef("start-feed");
  const startScreenSharing_button = useTemplateRef("screenEnable");
  const stopScreenSharing_button = useTemplateRef("screenStop");
  let audioEnable = ref(true); // checkbox enable audio
  let videoEnable = ref(true); // checkbox enable video

  // TRANPORTS AND PRODUCERS
  let screenTransport = null; // transport para screenSharing
  let producerTransport = null; // transport para webcam/mic
  let videoProducer = null; 
  let audioProducer = null; 
  let screenVideoProducer = null;
  let screenAudioProducer = null;

  // ======== FIM GLOBAL VARIABLES ========= //
  

  // ========== SOCKET HANDLERS =========== //

  const socket = io.connect(`http://localhost:3031`);
  socket.on('connect', () => {
    console.log("INIT CONNECTED!");
  });

  // Atualiza front com os novos producers da sala
  socket.on('updateActiveSpeakers', async newListOfActives => {
    console.log("== updateActiveSpeakers ==");
    console.log(newListOfActives);
    // an array of the most recent 5 dominant speakers. Just grab the 1st
      //and put ir in the slot. Move everything else down
      // consumers is an {} with key audioId, value of combined feed
    try{
      // remove all videos from video Elms ** most simple way to do
      const remoteEls = document.getElementsByClassName('remote-video');
      for(let el of remoteEls) el.srcObject = null;
      
      console.log("=== CONSUMERS ====");
      console.log(consumers);
      
      // itera consumers
      for(let i = 0; i < newListOfActives.length ; i++){
        let aid = newListOfActives[i];
        const consumerForThisSlot = consumers[aid];

        if(!consumerForThisSlot) continue;

        const userName = consumerForThisSlot.userName;
        const slotIndex = layoutStore.layoutMap[userName] ?? layoutStore.incrementSlot(); 

        const remoteVideo = document.getElementById(`remote-video-${slotIndex}`);
        const remoteScreen = document.getElementById(`remoteScreen-video-${slotIndex}`);
        const remoteVideoUserName = document.getElementById(`username-${slotIndex}`);

        console.log("remote-screen", remoteScreen);
        console.log("remote-video", remoteVideo);
        console.log("AID: ", aid);
        console.log("CONSUMER: ", consumerForThisSlot);

        if (remoteVideo && consumerForThisSlot.combineStream){
          if(userName === user.value) remoteVideo.muted = true;
          remoteVideo.srcObject = consumerForThisSlot.combineStream;
        }
          
        if(remoteScreen && consumerForThisSlot.screenStream){
          remoteScreen.srcObject = null;
          remoteScreen.srcObject = consumerForThisSlot.screenStream;
          if(isCreator.value) remoteScreen.muted = true;
        }
          
        if (remoteVideoUserName)
          remoteVideoUserName.innerHTML = userName;
      }
    }catch(err){
      console.log("updateActiveSpeaker error: ", err);
    }
  });

  // para cliente (não criador):
  //  - se tiver solicitação de 'promote' aceita então possa comçar a produzir
  //  - se não tiver solicitacão aceita ou foi removido a consumer então pare de produzir
  socket.on('promoteDelta', async ({ promoted, demoted }) => {
    console.log("== promoteDelta ==", { promoted, demoted });
    if (promoted === user.value) {
      console.log("Você passou a ser producer!");
      if (!localStream) await enableFeed();
      await sendFeed();
      isProducer.value = true;
    } 
    else if (demoted === user.value) {
      console.log("Você passou a ser consumer!");
      await stopFeed();
      isProducer.value = false;
    } 
    else {
      console.log(`${promoted} foi promovido${demoted ? ` e ${demoted} foi rebaixado` : ''}`);
    }
  });

  // (*) quando professor rejeita??
  socket.on('promotionDenied', ({ reason }) => {
    if (reason === 'onlyCreator') {
      alert("Apenas o criador está ativo, não há ninguém para substituir.");
    } else {
      alert("Falha ao tentar promoção.");
    }
  });

  // atualiza lista de consumers locais e pede novos transport's para novos producers da sala
  socket.on('newProducersToConsume', consumeData => {
    console.log("== newProducersToConsume ==");
    console.log(consumeData);
    requestTransportToConsume(consumeData, socket, device, consumers, user.value);
  });

  // caso algum cliente sai da sala, então atualiza front
  socket.on('peerLeft', ({audioPid, userName}) => {
    console.log(`Usuario [${audioPid}] ${userName} saiu da sala!`);
    const slotIndex = layoutStore.layoutMap[userName];

    const remoteVideo = document.getElementById(`remote-video-${slotIndex}`);
    const remoteVideoUserName = document.getElementById(`username-${slotIndex}`);

    remoteVideo.srcObject = null;
    remoteVideoUserName.innerHTML = "";

    layoutStore.removeFromLayoutMap(userName);

    delete consumers[audioPid];
  });

  // caso a sala seja encerrada pelo servidor ou criador 
  socket.on('roomClosed', async () => {
    console.log("Sala encerrada pelo servidor ou criador da sala!");
    await cleanupLocalMedia();
    if(isProducer.value) isProducer.value = false;
    layoutStore.removeFromLayoutMap(user.value);
    socket.disconnect();
  });

  // ======== FIM SOCKET HANDLERS =========== //


  // =========== ROOM FUNCTONS ================= //
  
  // entra na sala, cria os consumers da sala e cria producerTransport do cliente
  const joinRoom = async () => {
    console.log("Joining...");

    const joinRoomResp = await socket.emitWithAck('joinRoom', {user: user.value, room: roomId.value});
    console.log(joinRoomResp);

    //caso o user seja o criador, mudamos front
    newRoom.value = joinRoomResp.newRoom;
    layoutStore.updateCreator(joinRoomResp.roomCreator);

    if(user.value === joinRoomResp.roomCreator) isCreator.value = true;

    device = new Device(); 
    await device.load({routerRtpCapabilities: joinRoomResp.routerRtpCapabilities});
    console.log(device);

    console.log("joinRoom:", joinRoomResp);

    //PLAHCEHOLDERS... start mekinjg the transport for current speakers
    // joinRoomResp contains arrays for:
    // audioPidsToCreate
    // mapped to videoPidsToCreate
    // mapped to usernames
    // These arrays, may be empty... they may have a max of 5 indices
    console.log("request transport");
    requestTransportToConsume(joinRoomResp, socket, device, consumers, user.value);

    //create producer transport - teste para medir eficiencia de troca!
    producerTransport = await createProduceTransport(socket, device);
    console.log("Have producer transport. Time to produce!"); // vou testart mover para o join!

    show_controls.value = true;
    leave_button.value.disabled = false;
    join_button.value.disabled = true;
  }

  // sai da sala
  const leaveRoom = async () => {
    console.log("Usuário saindo da sala!");

    try{
      if(isProducer.value && !isCreator.value) socket.emit("leaveRoom", {reason: 'producerLeft'});
      else if(isProducer.value && isCreator.value) socket.emit("leaveRoom", {reason: 'creatorLeft'});
      else socket.emit("leaveRoom", {reason: 'consumerLeft'});

      await cleanupLocalMedia();

      layoutStore.removeFromLayoutMap(user.value);

      socket.disconnect();

      console.log("Uusário saiu com sucesso!");

    }catch(err){
      console.log("Erro ao tentar sair da sala: ", err);
    }
  }

  // limpa transport's locais, limpa streams locais e limpa consumers object
  const cleanupLocalMedia = async () => {
    try{
      // fecha todos producers do webcam/mic e limpa localStream
      await stopFeed();

      // fecha todos os producers do destop e limpa localScreenStream
      await stopScreenSharing();

      // fecha os transport's
      if(producerTransport){
        await producerTransport.close();
        producerTransport = null;
      }

      if(screenTransport){
        await screenTransport.close();
        screenTransport = null;
      }

      // (*) temos consumerTransport - ver como deletar nos modulos

      // limpa consumers
      for(const key in consumers){
        const c = consumers[key];
        try { c.audioConsumer?.close(); } catch (err) { console.log("erro ao fechar audio consumer", err); }
        try { c.videoConsumer?.close(); } catch (err) { console.log("erro ao fechar video consumer", err); }
        try { c.screenVideoConsumer?.close(); } catch (err) { console.log("erro ao fechar screenvideo consumer", err); }
        try { c.screenAudioConsumer?.close(); } catch (err) { console.log("erro ao fechar screenvideo consumer", err); }
        c.consumerTransport?.close();
        delete consumers[key];
      }

      console.log(consumers);
      console.log("Reset front!");
      resetFront();

      console.log("Finish cleaning local media!");

    }catch(err){
      console.log("Error cleaning local media: ", err);
    }
  }

  // guarda o localStream do usuário (camera/audio)
  const enableFeed = async() =>{ 
    // const mic2Id = await getMic2() // for get other audio devices! ** important for more complicated options
    try{
      console.log("audio:", audioEnable.value)
      console.log("video:", videoEnable.value)

      localStream = await navigator.mediaDevices.getUserMedia({
        video: videoEnable.value ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 15, max: 20 }
        } : false,
        audio: {
          autoGainControl: false, noiseSuppression: true, echoCancellation: false //parameters for audio quality
        }, // ** simple just for now
      });

      if(videoEnable.value){
        console.log("video enable!");
        videoLeft_button.value.srcObject = localStream;
      }

      mute_button.value.disabled = !audioEnable.value;
      mutecamera_button.value.disabled = !videoEnable.value;
    }catch(err){
      console.log("ERROR OPEN LOCALSTREAM", err);
    }
  }

  // cria producer para o localStream com o respectivo producerTransport
  const sendFeed = async () => {
    // create a transport for a this client's upstrea,
    // it will handle both audio and video producers
    //producerTransport = await createProduceTransport(socket, device);
    //console.log("Have producer transport. Time to produce!"); // vou testart mover para o join!

    // create or producers - promovido a producer || creador da sala
    const producers = await createProducer(localStream, producerTransport);
    audioProducer = producers.audioProducer;
    videoProducer = producers.videoProducer;
    console.log(producers);
    
    state_feed.value.innerHTML = "ON!";
    startScreenSharing_button.value.disabled = false;
  }

  // fecha os producers e limpa localStream
  const stopFeed = async () => {
    try{
      if(audioProducer){
        await audioProducer.close();
        audioProducer = null;
      }

      if(videoProducer){
        await videoProducer.close();
        videoProducer = null;
      }

      if(localStream){
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
      }

      mute_button.value.disabled = true;
      mutecamera_button.value.disabled = true;

      state_feed.value.innerHTML = "OFF!";
      isProducer.value = false;

      console.log("FEED LOCAL FECHADO COM SUCESSO!");
    }catch(err){
      console.log(err);
    }
  }

  // [pro criador da sala] chama sendFeed() e enableFeed()
  const startFeed = async () => {
    start_feed.value.disabled = true;
    await enableFeed();
    await sendFeed();
    isProducer.value = true;
  }

  // guarda o localScreenStream do usuário (desktop/audioDesktop)
  const enableScreenSharing = async () => {
    console.log("Init screen sharing!");
    try{
      if(localScreenSharing){
        stopScreenSharing();
      }

      localScreenSharing = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { max: 1280 },
          height: { max: 720 },
          frameRate: { max: 15 },
          displaySurface: "monitor" 
        },
        audio: true,
      });

      if(!localScreenSharing){
        console.warn("Nenhuma stream de tela encontrado!");
        return;  
      }

      await sendScreenSharing();

      localScreenSharing.getVideoTracks()[0].addEventListener("ended", () => {
        console.log("Usuário parou o compartilhamento manualmente!");
        stopScreenSharing();
      });

    }catch(err){
      console.log("Some error: ", err);
    }
  }

  // cria novo producerTransport para o localScreenStream caso não exista, senao, usa existente 
  // e cria producer com o respectivo producerTransport
  const sendScreenSharing = async () => {
    console.log("Sending screen sharing!");

    // aqui é importatnte reaproveitar o transport existe.
    //  Evita problemas de conexão e consumo desnecessário pro servidor
    if(!screenTransport){
      screenTransport = await createProduceTransport(socket, device, true);
      console.log("Have screenTransport for screeen! Time to produce!");
    }else{
      console.log("We already have a transport, using existing!");
    }
    
    // importante fechar producers antigos, não há problema em recriar
    if(screenVideoProducer){
      screenVideoProducer.close();
      screenVideoProducer = null;
    }

    if(screenAudioProducer){
      screenAudioProducer.close();
      screenAudioProducer = null;
    }

    const producers = await createProducer(localScreenSharing, screenTransport, true);
    screenVideoProducer = producers.videoProducer;
    screenAudioProducer = producers.audioProducer;

    stopScreenSharing_button.value.disabled = false;
    startScreenSharing_button.value.disabled = true;

    console.log(screenVideoProducer);
    console.log(screenAudioProducer);
    console.log("Producers do screenSharing criados!");
  }

  // para o compartilhamento de tela, fecha producer
  const stopScreenSharing = async () => {
    console.log("Stop screenSharing!");

    try{
      if(screenVideoProducer){
        await screenVideoProducer.close();
        screenVideoProducer = null;
      }

      if(screenAudioProducer){
        await screenAudioProducer.close();
        screenAudioProducer = null;
      }

      if(localScreenSharing){
        localScreenSharing.getTracks().forEach(track => track.stop());
        localScreenSharing = null;
      }

      stopScreenSharing_button.value.disabled = true;
      startScreenSharing_button.value.disabled = false;
      const remoteScreen = document.getElementById(`remoteScreen-video-0`);
      remoteScreen.srcObject = null;

      console.log("screenSharing parado com sucesso!");

    }catch(err){
      console.log("Erro ao parar  screenSharing: ", err);
    }
  }

  // [pros ouvintes da sala] pede promoção ao servidor, ou seja, permissão para se tornar producer
  const requestPromotion = () => {
    console.log("Request promotion to speak!");
    
    socket.emitWithAck('requestPromotion', {user: user.value}); 
  }

  let originalTrack = null;
  let blackTrack = null;
  let cameraMuted = ref(false);

  // muta/desmuta a camera, substituindo o track com tela preta
  const muteCamera = async () => {
    try{
      if(cameraMuted.value){
      // === desmutar ===
      let newTrack;
      if (!originalTrack || originalTrack.readyState === "ended") {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoLeft_button.value.srcObject = stream;
        newTrack = stream.getVideoTracks()[0];
        originalTrack = newTrack;
        
      } else {
        newTrack = originalTrack;
      }
        await videoProducer.replaceTrack({ track: newTrack });
        cameraMuted.value = false;
        mutecamera_button.value.innerHTML = "Camera ON";
        socket.emit("cameraChange", "unmute");
       
      }else{
        // == muta camera ==
        if(!originalTrack) originalTrack = videoProducer.track;
        if(!blackTrack) blackTrack = createBlackVideoTrack();

        if (blackTrack.readyState === "ended") {
          blackTrack = createBlackVideoTrack();
        }

        await videoProducer.replaceTrack({ track: blackTrack });

        cameraMuted.value = true;
        videoLeft_button.value.srcObject = null;
        mutecamera_button.value.innerHTML = "Camera Muted";
        socket.emit("cameraChange", 'mute');
      }
    }catch(err){
      console.log(err)
    }
  }

  // muta/desmuta o microfone
  const muteAudio = () => {
    // mute at the producer level, to keep the transport, and all
    // ohter mechanism in place
    if(audioProducer.paused){
      audioProducer.resume();
      mute_button.value.innerHTML = "Audio ON";

      //unpause on the server
      socket.emit('audioChange', 'unmute')
    }else{
      audioProducer.pause();
      mute_button.value.innerHTML = "Audio Muted";
    
      socket.emit('audioChange', 'mute')
    }
  }

  // ========= AUX FUNCTIONS ========= //

  // cria a tela preta
  const createBlackVideoTrack = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");

    // Pintar preto
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const stream = canvas.captureStream(5); // 5 fps para baixo consumo
    return stream.getVideoTracks()[0];
  };

  // limpa variáveis de controle do front e da um refresh na página
  const resetFront = () => {
    user.value = "";
    roomId.value = "";
    newRoom.value = false;
    isProducer.value = false;
    isCreator.value = false;

    show_controls.value = false;

    leave_button.value.disabled = true;
    join_button.value.disabled = false;

    const remoteEls = document.getElementsByClassName('remote-video');
    for(let el of remoteEls) el.srcObject = null;

    const remoteNames = document.getElementsByClassName("username");
    for(let el of remoteNames) el.innerHTML = "";

    mute_button.value.disabled = true;
    mutecamera_button.value.disabled = true;

    state_feed.value.innerHTML = "OFF!"; // ON/OFF
    // start_feed.value.disabled = false;

    startScreenSharing_button.value.disabled = true;
    stopScreenSharing_button.value.disabled = true;
    audioEnable.value = true; // checkbox enable audio
    videoEnable.value = true; // checkbox enable video

    nextTick();

    console.log("refresh!");
    window.location.reload(true);
  }

</script>

<style scoped>
html{
  height: 100vh;
  width: 100vw;
  margin: 0px;
}

#app{
  height: 100%;
  width: 100%;
}

body{
  font-family: Georgia;
  height: 100%;
  width: 100%;
}

.remote-video, .local-video-left{
  width: 150px;
}

.container{
  height: 100%;
  width: 100%;
}

.username{
  width: 100%;
  height: 40px;
}

#local-video-left{
  left: 20px;
}

#local-video-right{
  right: 20px;
}

#message{
  position: absolute;
  top: 50%;
  left: 45%;
}

#room-info, #control-buttons{
  margin: 15px 0;
}
</style>
