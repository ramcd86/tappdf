<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium text-gray-900 mb-3">Tools</h3>
      <div class="space-y-2">
        <button
          v-for="tool in tools"
          :key="tool.id"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          :class="{ 'bg-primary-100 text-primary-700': activeTool === tool.id }"
          @click="setActiveTool(tool.id)"
        >
          <span class="text-lg">{{ tool.icon }}</span>
          <span class="text-sm font-medium">{{ tool.label }}</span>
        </button>
      </div>
    </div>

    <div v-if="activeTool === 'text'" class="pt-4 border-t border-gray-200">
      <h3 class="text-sm font-medium text-gray-900 mb-3">Text Options</h3>
      <div class="space-y-3">
        <div>
          <label class="text-xs text-gray-600 block mb-1">Font Size</label>
          <input
            v-model="textOptions.fontSize"
            type="number"
            min="8"
            max="72"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
        </div>
        <div>
          <label class="text-xs text-gray-600 block mb-1">Color</label>
          <input
            v-model="textOptions.color"
            type="color"
            class="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
          >
        </div>
      </div>
    </div>

    <div v-if="activeTool === 'image'" class="pt-4 border-t border-gray-200">
      <h3 class="text-sm font-medium text-gray-900 mb-3">Image Options</h3>
      <button class="w-full btn-secondary text-sm">
        Upload Image
      </button>
    </div>

    <div class="pt-4 border-t border-gray-200">
      <h3 class="text-sm font-medium text-gray-900 mb-3">Actions</h3>
      <div class="space-y-2">
        <button class="w-full btn-secondary text-sm">
          Undo
        </button>
        <button class="w-full btn-secondary text-sm">
          Redo
        </button>
        <button class="w-full btn-secondary text-sm text-red-600">
          Delete Selected
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const activeTool = ref<string | null>(null)

const tools = [
  { id: 'select', label: 'Select', icon: '👆' },
  { id: 'text', label: 'Add Text', icon: '📝' },
  { id: 'image', label: 'Add Image', icon: '🖼️' },
  { id: 'shape', label: 'Add Shape', icon: '⬜' },
  { id: 'highlight', label: 'Highlight', icon: '🖍️' }
]

const textOptions = ref({
  fontSize: 14,
  color: '#000000'
})

const setActiveTool = (toolId: string) => {
  activeTool.value = toolId
  // TODO: Notify overlay canvas of tool change
}
</script>
