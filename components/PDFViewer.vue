<template>
  <div class="pdf-viewer">
    <div v-if="loading" class="flex items-center justify-center p-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <p class="text-sm text-red-800">{{ error }}</p>
    </div>

    <div v-else ref="containerRef" class="space-y-4">
      <canvas
        v-for="pageNum in totalPages"
        :key="pageNum"
        :ref="el => setCanvasRef(el as HTMLCanvasElement, pageNum)"
        class="border border-gray-300 shadow-lg mx-auto bg-white"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// PDF.js viewer component
// Will be implemented with full PDF.js integration

const containerRef = ref<HTMLElement | null>(null)
const canvasRefs = ref<Map<number, HTMLCanvasElement>>(new Map())
const loading = ref(true)
const error = ref<string | null>(null)
const totalPages = ref(0)

const setCanvasRef = (el: HTMLCanvasElement, pageNum: number) => {
  if (el) {
    canvasRefs.value.set(pageNum, el)
  }
}

// TODO: Implement PDF.js integration
// - Load PDF document
// - Render each page to canvas
// - Handle zoom/scale
// - Emit page dimensions for overlay

onMounted(() => {
  // Placeholder - will implement PDF loading
  loading.value = false
  totalPages.value = 1
})
</script>

<style scoped>
.pdf-viewer {
  position: relative;
}
</style>
