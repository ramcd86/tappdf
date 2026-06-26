<template>
  <div class="overlay-canvas-wrapper" :style="wrapperStyle">
    <div ref="containerRef" class="konva-container"></div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  width?: number
  height?: number
}>()

const overlay = useOverlay()
const containerRef = ref<HTMLDivElement | null>(null)
const wrapperStyle = computed(() => ({
  width: props.width ? `${props.width}px` : 'auto',
  height: props.height ? `${props.height}px` : 'auto',
}))

const isInitialized = ref(false)

// Initialize when mounted and dimensions are available
onMounted(() => {
  if (containerRef.value && props.width && props.height && !isInitialized.value) {
    overlay.initCanvas(containerRef.value as HTMLDivElement, props.width, props.height)
    isInitialized.value = true
  }
})

// Re-initialize only if dimensions change significantly
watch(() => [props.width, props.height], ([width, height]) => {
  if (containerRef.value && width && height && isInitialized.value && overlay.stage.value) {
    // Resize existing stage
    overlay.stage.value.width(width)
    overlay.stage.value.height(height)
    overlay.stage.value.draw()
  }
})

onUnmounted(() => {
  overlay.dispose()
})

// Expose overlay methods to parent
defineExpose({
  selectedFormatting: overlay.selectedFormatting,
  addText: overlay.addText,
  addImage: overlay.addImage,
  addRectangle: overlay.addRectangle,
  addCircle: overlay.addCircle,
  addHighlight: overlay.addHighlight,
  deleteSelected: overlay.deleteSelected,
  getOverlaysJSON: overlay.getOverlaysJSON,
  getSelectedTextNode: overlay.getSelectedTextNode,
  getTextFormattingState: overlay.getTextFormattingState,
  toggleTextStyle: overlay.toggleTextStyle,
  toggleTextDecoration: overlay.toggleTextDecoration,
  updateTextFormatting: overlay.updateTextFormatting,
  updateTextColor: overlay.updateTextColor,
})
</script>

<style scoped>
.overlay-canvas-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
}

.konva-container {
  width: 100%;
  height: 100%;
}

.konva-container :deep(canvas) {
  border: 2px solid rgba(59, 130, 246, 0.5);
  background: rgba(255, 0, 0, 0.05); /* Slight red tint to see canvas area */
}
</style>
