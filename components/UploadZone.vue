<template>
  <div class="space-y-4">
    <div
      class="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center hover:border-primary-500 transition-colors cursor-pointer"
      :class="{ 'border-primary-500 bg-primary-900/20': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
      @click="triggerFileInput"
    >
      <input
        ref="fileInput"
        type="file"
        accept=".pdf,application/pdf"
        class="hidden"
        @change="handleFileSelect"
      >

      <div v-if="!upload.uploading.value && !upload.result.value">
        <svg class="w-16 h-16 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p class="text-lg font-medium text-gray-200 mb-2">
          Drop your PDF here or click to browse
        </p>
        <p class="text-sm text-gray-500">
          Maximum file size: 10MB
        </p>
      </div>

      <div v-else-if="upload.uploading.value" class="py-4">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4" />
        <p class="text-sm text-gray-400">Uploading your PDF...</p>
        <div class="w-full bg-gray-700 rounded-full h-2 mt-4 max-w-xs mx-auto">
          <div
            class="bg-primary-500 h-2 rounded-full transition-all duration-300"
            :style="{ width: `${upload.progress.value?.percentage || 0}%` }"
          />
        </div>
      </div>

      <div v-else-if="upload.result.value" class="py-4">
        <svg class="w-12 h-12 mx-auto text-green-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <p class="text-lg font-medium text-gray-200">
          File uploaded successfully!
        </p>
        <p class="text-sm text-gray-400 mt-1">
          Redirecting to editor...
        </p>
      </div>
    </div>

    <div v-if="upload.error.value" class="bg-red-900/30 border border-red-700 rounded-lg p-4">
      <p class="text-sm text-red-300">{{ upload.error.value.message }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const upload = useFileUpload()

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    uploadFile(file)
  }
}

const handleDrop = (event: DragEvent) => {
  isDragging.value = false
  const file = event.dataTransfer?.files[0]
  if (file) {
    uploadFile(file)
  }
}

const uploadFile = async (file: File) => {
  const result = await upload.uploadFile(file)
  
  if (result) {
    // Navigate to editor after short delay
    setTimeout(() => {
      navigateTo(`/editor?id=${result.documentId}`)
    }, 500)
  }
}
</script>
