<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium text-gray-300 mb-3">
        Tools
      </h3>
      <!-- Hidden file input for image upload -->
      <input
        ref="imageInput"
        type="file"
        accept="image/png,image/jpeg"
        class="hidden"
        @change="handleImageUpload"
      >
      <div
        v-if="imageError"
        class="text-xs text-red-400 bg-red-900/30 border border-red-700 rounded px-2 py-1 mb-2"
      >
        {{ imageError }}
      </div>
      <div class="space-y-2">
        <button
          v-for="tool in tools"
          :key="tool.id"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors text-gray-300"
          :class="{ 'bg-primary-900 text-primary-300': activeTool === tool.id }"
          @click="handleToolClick(tool.id)"
        >
          <span class="text-lg">{{ tool.icon }}</span>
          <span class="text-sm font-medium">{{ tool.label }}</span>
        </button>
      </div>
    </div>

    <div
      v-if="activeTool === 'shape'"
      class="pt-4"
    >
      <h3 class="text-sm font-medium text-gray-300 mb-3">
        Shape Type
      </h3>
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
        <button
          class="w-full btn-secondary text-sm"
          @click="emit('addShape', 'triangle')"
        >
          Triangle
        </button>
        <button
          class="w-full btn-secondary text-sm"
          @click="emit('addShape', 'line')"
        >
          Line
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  addText: [options: { fontSize: number, color: string }]
  addImage: [imageUrl: string]
  addShape: [type: 'rectangle' | 'circle' | 'triangle' | 'line']
  addHighlight: []
  selectMode: [active: boolean]
}>()

const activeTool = ref<string | null>(null)
const imageInput = ref<HTMLInputElement | null>(null)
const imageError = ref<string | null>(null)

const tools = [
  { id: 'select', label: 'Select', icon: '👆' },
  { id: 'text', label: 'Add Text', icon: '📝' },
  { id: 'image', label: 'Add Image', icon: '🖼️' },
  { id: 'shape', label: 'Add Shape', icon: '⬜' },
  { id: 'highlight', label: 'Highlight', icon: '🖍️' },
]

const textOptions = { fontSize: 14, color: '#000000' }

function handleToolClick(toolId: string) {
  activeTool.value = toolId
  emit('selectMode', toolId === 'select')

  if (toolId === 'text') {
    emit('addText', textOptions)
  }
  else if (toolId === 'image') {
    imageInput.value?.click()
  }
  else if (toolId === 'highlight') {
    emit('addHighlight')
  }
}

function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  imageError.value = null

  if (file) {
    const allowed = ['image/png', 'image/jpeg']
    if (!allowed.includes(file.type)) {
      imageError.value = 'Only PNG and JPG/JPEG images are supported.'
      target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string
      emit('addImage', imageUrl)
    }
    reader.readAsDataURL(file)
  }
}
</script>
