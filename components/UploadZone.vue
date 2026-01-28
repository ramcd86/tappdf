<template>
  <div class="space-y-4">
    <div
      class="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-primary-400 transition-colors cursor-pointer"
      :class="{ 'border-primary-500 bg-primary-50': isDragging }"
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

      <div v-if="!uploading && !uploadedFile">
        <svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p class="text-lg font-medium text-gray-900 mb-2">
          Drop your PDF here or click to browse
        </p>
        <p class="text-sm text-gray-500">
          Maximum file size: 10MB
        </p>
      </div>

      <div v-else-if="uploading" class="py-4">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
        <p class="text-sm text-gray-600">Uploading your PDF...</p>
        <div class="w-full bg-gray-200 rounded-full h-2 mt-4 max-w-xs mx-auto">
          <div
            class="bg-primary-600 h-2 rounded-full transition-all duration-300"
            :style="{ width: `${uploadProgress}%` }"
          />
        </div>
      </div>

      <div v-else-if="uploadedFile" class="py-4">
        <svg class="w-12 h-12 mx-auto text-green-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <p class="text-lg font-medium text-gray-900">
          {{ uploadedFile.name }}
        </p>
        <p class="text-sm text-gray-500 mt-1">
          Ready to edit
        </p>
      </div>
    </div>

    <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <p class="text-sm text-red-800">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadedFile = ref<File | null>(null)
const error = ref<string | null>(null)

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
  error.value = null

  // Validate file type
  if (file.type !== 'application/pdf') {
    error.value = 'Please upload a PDF file'
    return
  }

  // Validate file size (10MB)
  if (file.size > 10 * 1024 * 1024) {
    error.value = 'File size must be less than 10MB'
    return
  }

  uploading.value = true
  uploadProgress.value = 0

  try {
    const formData = new FormData()
    formData.append('file', file)

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      if (uploadProgress.value < 90) {
        uploadProgress.value += 10
      }
    }, 200)

    const response = await $fetch('/api/upload', {
      method: 'POST',
      body: formData
    })

    clearInterval(progressInterval)
    uploadProgress.value = 100

    uploadedFile.value = file

    // Navigate to editor after short delay
    setTimeout(() => {
      navigateTo(`/editor?id=${response.documentId}`)
    }, 500)
  } catch (err) {
    error.value = 'Upload failed. Please try again.'
    console.error('Upload error:', err)
  } finally {
    uploading.value = false
  }
}
</script>
