import { useLayoutStore } from "@/stores/layout";

const renderLayout = (consumers, currentUser) => {
    console.log("im just calling?")
    const layoutStore = useLayoutStore()
    const remoteEls = document.getElementsByClassName('remote-video');
    for(let el of remoteEls) el.srcObject = null;

    for(const pid in consumers){
        console.log("creator", layoutStore.creatorUserName);
        console.log("layoutmap",layoutStore.layoutMap);

        const { combineStream, screenStream, userName } = consumers[pid];
        const slotIndex = layoutStore.layoutMap[userName] ?? layoutStore.incrementSlot();
        
        const remoteVideo = document.getElementById(`remote-video-${slotIndex}`);
        const remoteScreen = document.getElementById(`remoteScreen-video-${slotIndex}`);
        const remoteVideoUserName = document.getElementById(`username-${slotIndex}`);

        if(remoteVideo && combineStream){
            if(currentUser === userName) remoteVideo.muted = true;
            remoteVideo.srcObject = combineStream;
        }
            
        if(remoteScreen && screenStream){
            if(currentUser === layoutStore.creatorUserName) remoteScreen.muted = true;
            remoteScreen.srcObject = screenStream;
        }
            

        if(remoteVideoUserName)
            remoteVideoUserName.innerHTML = userName;
    }
}

export default renderLayout;