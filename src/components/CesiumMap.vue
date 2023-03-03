<template lang="">
  <div id="container" @click="mapClick"></div>
</template>
<script setup lang="ts">
import { onMounted} from "vue";
import map3d from "../map3d";
onMounted(() => {
  map3d.initMap("container");
});
</script>
<style lang="css" scoped>
#container {
  width: 100%;
  height: 100%;
  padding: 0px;
  margin: 0px;
}
</style>
