<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium text-gray-900 mb-3">Tools</h3>
      <!-- Hidden file input for image upload -->
      <input
        ref="imageInput"
        type="file"
        accept="image/*"
        class="hidden"
        @change="handleImageUpload"
      >
      <div class="space-y-2">
        <button
          v-for="tool in tools"
          :key="tool.id"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          :class="{ 'bg-primary-100 text-primary-700': activeTool === tool.id }"
          @click="handleToolClick(tool.id)"
        >
          <span class="text-lg">{{ tool.icon }}</span>
          <span class="text-sm font-medium">{{ tool.label }}</span>
        </button>
      </div>
    </div>

    <!-- Text options removed - now in header toolbar -->

    <div v-if="activeTool === 'shape'" class="pt-4 border-t border-gray-200">
      <h3 class="text-sm font-medium text-gray-900 mb-3">Shape Type</h3>
      <div class="space-y-2">
        <button 
          class="w-full btn-secondary text-sm"
          @click="emit('addShape', 'rectangle')"
        >
          Rectangle
        </button>
        <button 
          class="w-full btn-secondary text-sm"
          @click="emit('addShape', 'circle')"
        >
          Circle
        </button>
      </div>
    </div>


    <div class="pt-4 border-t border-gray-200">
      <h3 class="text-sm font-medium text-gray-900 mb-3">Actions</h3>
      <div class="space-y-2">
        <button 
          class="w-full btn-secondary text-sm text-red-600"
          @click="emit('deleteSelected')"
        >
          Delete Selected
        </button>
        <button 
          class="w-full btn-secondary text-sm"
          @click="emit('exportJSON')"
        >
          Export JSON
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  addText: [options: { fontSize: number; color: string }]
  addImage: [imageUrl: string]
  addShape: [type: 'rectangle' | 'circle']
  addHighlight: []
  deleteSelected: []
  exportJSON: []
}>()

const activeTool = ref<string | null>(null)
const imageInput = ref<HTMLInputElement | null>(null)

const tools = [
  { id: 'select', label: 'Select', icon: '👆' },
  { id: 'text', label: 'Add Text', icon: '📝' },
  { id: 'image', label: 'Add Image', icon: '🖼️' },
  { id: 'shape', label: 'Add Shape', icon: '⬜' },
  { id: 'highlight', label: 'Highlight', icon: '🖍️' },
]

const textOptions = ref({
  fontSize: 14,
  color: '#000000',
})

function handleToolClick(toolId: string) {
  activeTool.value = toolId

  if (toolId === 'text') {
    emit('addText', textOptions.value)
  }
  else if (toolId === 'image') {
    imageInput.value?.click()   // open file picker immediately
  }
  else if (toolId === 'highlight') {
    emit('addHighlight')
  }
}

function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string
      emit('addImage', imageUrl)
    }
    reader.readAsDataURL(file)
  }
}
</script>
