<template>
  <div class="flex items-center gap-3">
    <button
      class="px-3 py-1 text-sm rounded hover:bg-gray-700 disabled:opacity-50 text-gray-200"
      :disabled="pdf.state.currentPage <= 1"
      @click="pdf.previousPage()"
    >
      ←
    </button>

    <span class="text-sm text-gray-400">
      Page {{ pdf.state.currentPage }} of {{ pdf.state.totalPages }}
    </span>

    <button
      class="px-3 py-1 text-sm rounded hover:bg-gray-700 disabled:opacity-50 text-gray-200"
      :disabled="pdf.state.currentPage >= pdf.state.totalPages"
      @click="pdf.nextPage()"
    >
      →
    </button>

    <div class="ml-4 flex items-center gap-2">
      <button
        class="px-2 py-1 text-sm rounded hover:bg-gray-700 disabled:opacity-50 text-gray-200"
        :disabled="pdf.state.scale <= 0.5"
        @click="pdf.zoomOut()"
      >
        −
      </button>
      <span class="text-sm text-gray-400 min-w-[50px] text-center">
        {{ Math.round(pdf.state.scale * 100) }}%
      </span>
      <button
        class="px-2 py-1 text-sm rounded hover:bg-gray-700 disabled:opacity-50 text-gray-200"
        :disabled="pdf.state.scale >= 3.0"
        @click="pdf.zoomIn()"
      >
        +
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const pdf = usePDF()
</script>
