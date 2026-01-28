<template>
  <div class="flex items-center gap-3">
    <button
      class="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
      :disabled="currentPage <= 1"
      @click="previousPage"
    >
      ←
    </button>
    
    <span class="text-sm text-gray-600">
      Page {{ currentPage }} of {{ totalPages }}
    </span>
    
    <button
      class="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
      :disabled="currentPage >= totalPages"
      @click="nextPage"
    >
      →
    </button>

    <div class="ml-4 flex items-center gap-2">
      <button
        class="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
        @click="zoomOut"
      >
        -
      </button>
      <span class="text-sm text-gray-600 min-w-[50px] text-center">
        {{ Math.round(zoom * 100) }}%
      </span>
      <button
        class="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
        @click="zoomIn"
      >
        +
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const currentPage = ref(1)
const totalPages = ref(1)
const zoom = ref(1.0)

const previousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    // TODO: Scroll to page
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    // TODO: Scroll to page
  }
}

const zoomIn = () => {
  if (zoom.value < 2.0) {
    zoom.value = Math.min(2.0, zoom.value + 0.1)
    // TODO: Apply zoom to PDF viewer
  }
}

const zoomOut = () => {
  if (zoom.value > 0.5) {
    zoom.value = Math.max(0.5, zoom.value - 0.1)
    // TODO: Apply zoom to PDF viewer
  }
}
</script>
