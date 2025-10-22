import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useLayoutStore = defineStore('layout', () => {
  const creatorUserName = ref(null)
  const limitLayout = ref(1) // mudar para numero max da room (*)
  const layoutMap = ref({})
  const nextSlotIndex = ref(0)

  function updateCreator(creator) {
    creatorUserName.value = creator;
  }

  function incrementSlot(){
    if(nextSlotIndex.value >= limitLayout.value) nextSlotIndex.value = 1;
    else nextSlotIndex.value++;

    return nextSlotIndex.value;
  }

  function setLayoutMap(property, value){
    console.log("set property ", property, "with value ", value);
    layoutMap.value[property] = value;
  }

  function removeFromLayoutMap(property){
    if(property in layoutMap.value){
      console.log("removendo propriedade", property, "do layoutMap");
      delete layoutMap.value[property];
      
      nextSlotIndex.value--;
      if(nextSlotIndex.value <= 0) nextSlotIndex.value = 0;
    }
  }

  return { creatorUserName, layoutMap, nextSlotIndex, updateCreator, incrementSlot, setLayoutMap, removeFromLayoutMap }
})
