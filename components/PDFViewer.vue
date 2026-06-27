<template>
  <ClientOnly>
    <div class="pdf-viewer">
      <div v-if="pdf.state.loading" class="flex items-center justify-center p-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        <span class="ml-3 text-gray-600">Loading PDF...</span>
      </div>

      <div v-else-if="pdf.state.error" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-sm text-red-800">{{ pdf.state.error }}</p>
      </div>

      <div v-else class="relative">
        <canvas
          ref="canvasRef"
          class="border border-gray-300 shadow-lg mx-auto bg-white"
        />
      </div>
    </div>
    <template #fallback>
      <div class="flex items-center justify-center p-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        <span class="ml-3 text-gray-600">Initializing...</span>
      </div>
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
const props = defineProps<{
  documentId: string
}>()

const emit = defineEmits<{
  loaded: [dimensions: { width: number; height: number; scale: number }]
}>()

const pdf = usePDF()
const canvasRef = ref<HTMLCanvasElement | null>(null)

onMounted(async () => {
  if (!props.documentId) {
    pdf.state.error = 'No document ID provided'
    return
  }

  try {
    // Fetch document info to get the PDF URL
    const doc = await $fetch(`/api/document/${props.documentId}`)
    
    if (!doc.uploadUrl) {
      pdf.state.error = 'Document URL not found'
      return
    }
    
    // Load PDF document
    const success = await pdf.loadPDF(doc.uploadUrl)
    
    if (!success) {
      return
    }
    
    // Wait for canvas to be ready
    await nextTick()
    
    if (canvasRef.value && pdf.state.totalPages > 0) {
      // Render first page at current scale
      await pdf.renderPage(1, canvasRef.value, pdf.state.scale)
      
      // Emit actual rendered canvas dimensions + scale
      if (canvasRef.value) {
        emit('loaded', {
          width: canvasRef.value.width,
          height: canvasRef.value.height,
          scale: pdf.state.scale,
        })
      }
    }
  }
  catch (error: any) {
    console.error('Failed to load PDF:', error)
    pdf.state.error = error.message || 'Failed to load PDF'
  }
})

// Watch for page OR scale changes and re-render
watch([() => pdf.state.currentPage, () => pdf.state.scale], async ([newPage, newScale]) => {
  if (canvasRef.value && newPage > 0) {
    await pdf.renderPage(newPage, canvasRef.value, newScale)
    if (canvasRef.value) {
      emit('loaded', {
        width: canvasRef.value.width,
        height: canvasRef.value.height,
        scale: newScale,
      })
    }
  }
})

// When loadPDF finishes, state.loading flips false and the <canvas> element is
// recreated fresh at browser-default 300×150. Re-render onto the new element
// regardless of whether currentPage changed.
watch(() => pdf.state.loading, async (isLoading) => {
  if (isLoading || !pdf.state.currentPage) return
  await nextTick()  // let Vue restore the canvas ref after the v-else re-mounts
  if (canvasRef.value && pdf.state.currentPage > 0) {
    await pdf.renderPage(pdf.state.currentPage, canvasRef.value, pdf.state.scale)
    if (canvasRef.value) {
      emit('loaded', {
        width: canvasRef.value.width,
        height: canvasRef.value.height,
        scale: pdf.state.scale,
      })
    }
  }
})

onUnmounted(() => {
  pdf.unload()
})
</script>

<style scoped>
.pdf-viewer {
  position: relative;
}
</style>
