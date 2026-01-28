<template>
  <div class="overlay-canvas-wrapper">
    <!-- Fabric.js canvas will be initialized here -->
    <canvas ref="canvasRef" />
  </div>
</template>

<script setup lang="ts">
// Fabric.js overlay canvas component
// Will be implemented with full Fabric.js integration

const canvasRef = ref<HTMLCanvasElement | null>(null)

// TODO: Implement Fabric.js integration
// - Initialize fabric canvas
// - Add object tools (text, image, shape)
// - Handle object manipulation
// - Serialize to JSON
// - Sync with PDF page dimensions

onMounted(() => {
  // Placeholder - will initialize Fabric canvas
  console.log('OverlayCanvas mounted')
})
</script>

<style scoped>
.overlay-canvas-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

canvas {
  pointer-events: auto;
}
</style>
