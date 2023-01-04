<template lang="">
    <div id="container"></div>
</template>
<script setup>
    import { onMounted } from "vue";
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
