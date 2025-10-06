<template>
  <section class="container">
    <section style="height: 20%">
      <div id="room-info">
			  Room: <input id="room-input" placeholder="Room Name" v-model="roomId" type="text" />
			  User:<input id="username" v-model="user" type="text" />
			  <button @click="joinRoom" id="join-room">Join</button>
	  	</div>

		  <!-- Buttons that setup the call/control feed -->
	    <div id="control-buttons" class="d-none" v-if="show_controls">
        <section>
          <h4>enable audio</h4>
          <input type="checkbox" name="checkboxAudio" class="checbox-input" v-model="audioEnable" />
          <h4>enable video</h4>
          <input type="checkbox" name="checkboxVideo" class="checbox-input" v-model="videoEnable" />
        </section>
        <button ref="enable-feed" @click="enableFeed" class="btn btn-primary"> Feed On</button>
		    <button ref="send-feed" @click="sendFeed" class="btn btn-success" disabled> Send Feed</button>
		    <button ref="mute" @click="muteAudio" class="btn btn-success" disabled> Audio On</button>
		    <button ref="hang-up" class="btn btn-danger" disabled> Hangup</button>
		  </div>
    </section>

		<!-- Small videos at top (non dominant speaker) -->
		<section style="height: 50%;">
      <div id="remote-media" style="display:flex;align-items: center;justify-content: center;">
			<div class="remote-video-container border border-primary remote-speaker" style="width:20%">
				<video ref="remote-video-1" id="remote-video-1" class="w-100 h-100 remote-video" autoplay inline controls></video>
				<div ref="username-1" id="username-1" class="username"></div>
			</div>
      <div class="remote-video-container border border-primary" style="width: 20%;">
        <video ref="remote-video-2" id="remote-video-2" class="w-100 h-100 remote-video" autoplay inline controls></video>
        <div ref="username-2" id="username-2" class="username"></div>
      </div>
      <div class="remote-video-container border border-primary" style="width: 20%;">
        <video ref="remote-video-3" id="remote-video-3" class="w-100 h-100 remote-video" autoplay inline controls></video>
        <div ref="username-3" id="username-3" class="username"></div>
      </div>
      <div class="remote-video-container border border-primary" style="width: 20%;">
        <video ref="remote-video-4" id="remote-video-4" class="w-100 h-100 remote-video" autoplay inline controls></video>
        <div ref="username-4" id="username-4" class="username"></div>
        </div>
      </div>
    </section>
	
		<!-- Current Speaker Video (Large Center Video) -->
		<section style="height: 30%; margin-top:10px;">
      <h2>Dominant Speaker</h2>
      <div id="current-speaker" style="text-align: center;">
        <div class="current-video-container" style="width: 100%; height: 400px; margin: 10;">
          <video style="width:100%; height:100%" id="remote-video-0" class="w-100 h-100 border border-primary remote-video" autoplay inline controls></video>
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
  import { ref, useTemplateRef } from 'vue'
  import createProduceTransport from '../mediaSoupFunctions/createProducerTranposrt';
  import createProducer from '../mediaSoupFunctions/createProducer';
  import requestTransportToConsume from '../mediaSoupFunctions/requestTransportToConsume';


  let device = null;
  let localStream = null;
  let producerTransport = null;
  let videoProducer = null;
  let audioProducer = null; // THIS client's producer
  let consumers = {} // key off the audioPid


  const socket = io.connect(`http://localhost:3031`);
  socket.on('connect', () => {
    console.log("INIT CONNECTED!");
  });

  socket.on('updateActiveSpeakers', async newListOfActives => {
    console.log("== updateActiveSpeakers ==");
    console.log(newListOfActives);
    // an array of the most recent 5 dominant speakers. Just grab the 1st
      //and put ir in the slot. Move everything else down
      // consumers is an {} with key audioId, value of combined feed
    console.log(newListOfActives);
    try{
      let slot = 0;
      // remove all videos from video Elms ** most simple way to do
      const remoteEls = document.getElementsByClassName('remote-video');
      for(let el of remoteEls){
        el.srcObject = null;
      }

      newListOfActives.forEach(aid => {
        if(aid !== audioProducer?.id){
          // do not show THIS client in a video tag, other than local
          // put this video in the next available slot
          const remoteVideo = document.getElementById(`remote-video-${slot}`);
          console.log("remote-video", remoteVideo);
          console.log("CONSUMERS", consumers);
          console.log("AID: ", aid);
          const remoteVideoUserName = document.getElementById(`username-${slot}`);
          const consumerForThisSlot = consumers[aid];
          console.log("CONSUMER: ", consumerForThisSlot);

          remoteVideo.srcObject = consumerForThisSlot?.combineStream;
          remoteVideoUserName.innerHTML = consumerForThisSlot?.userName;
          slot++; //for the next
        }
      })
    }catch(err){
      console.log(err);
    }
  });

  socket.on('newProducersToConsume', consumeData => {
    console.log("== newProducersToConsume ==");
    console.log(consumeData);
    requestTransportToConsume(consumeData, socket, device, consumers);
  });

  const user = ref("");
  const roomId = ref("");
  const show_controls = ref(false);

  const joinRoom = async () => {
    console.log("Joining...");

    const joinRoomResp = await socket.emitWithAck('joinRoom', {user: user.value, room: roomId.value});
    console.log(joinRoomResp);

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
    requestTransportToConsume(joinRoomResp, socket, device, consumers);

    show_controls.value = true;
  }

  const videoLeft_button = useTemplateRef("local-video-left");
  const sendFeed_button = useTemplateRef("send-feed");
  const enableFeed_button = useTemplateRef("enable-feed");
  const mute_button = useTemplateRef("mute");
  const handUp_button = useTemplateRef("hang-up");

  let audioEnable = ref(true);
  let videoEnable = ref(true);

  const enableFeed = async() =>{ 
    // const mic2Id = await getMic2() // for get other audio devices! ** important for more complicated options
    try{
      console.log("audio:", audioEnable.value)
      console.log("video:", videoEnable.value)

      localStream = await navigator.mediaDevices.getUserMedia({
        video: videoEnable.value,
        audio: audioEnable.value, // ** simple just for now
      });

      if(videoEnable.value){
        console.log("video enable!");
        videoLeft_button.value.srcObject = localStream;
      }

      enableFeed_button.value.disabled = true;
      sendFeed_button.value.disabled = false;
      mute_button.value.disabled = !audioEnable.value;

    }catch(err){
      console.log("ERROR OPEN LOCALSTREAM", err);
    }
  }

  const sendFeed = async () => {
    // create a transport for a this client's upstrea,
    // it will handle both audio and video producers
    producerTransport = await createProduceTransport(socket, device);
    console.log("Have producer transport. Time to produce!");
    // create or producers
    const producers = await createProducer(localStream, producerTransport);
    audioProducer = producers.audioProducer;
    videoProducer = producers.videoProducer;
    console.log(producers);
    
    handUp_button.value.disabled = false;
  }

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
