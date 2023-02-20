<script setup lang="ts">
import { number } from "mathjs";
import { provide, ref, watch } from "vue";
import CesiumMap from "./components/CesiumMap.vue";
const num = ref<number>(0);
provide("num", num);
watch(
	num,
	(newValue, oldValue) => {
		console.log(`新:${newValue};旧:${oldValue}`);
	},
	{ immediate: true }
);
</script>

<template>
	<div id="root">
		<CesiumMap></CesiumMap>
	</div>
</template>

<style scoped lang="css">
#root {
	width: 100%;
	height: 100%;
	padding: 0px;
	margin: 0px;
}
</style>
