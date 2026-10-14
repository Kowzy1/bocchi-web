<template>
  <div class="stage">
    <canvas ref="canvasEl"></canvas>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { BocchiApp } from './app.js';

const canvasEl = ref(null);
let app = null;

onMounted(async () => {
  app = new BocchiApp(canvasEl.value);
  await app.start();
});

onBeforeUnmount(() => {
  app?.stop();
  app = null;
});
</script>
