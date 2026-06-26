<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="card max-w-md text-center">
      <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      
      <h1 class="text-2xl font-bold mb-2">Payment Successful!</h1>
      <p class="text-gray-600 mb-6">Your PDF is being generated and will download shortly.</p>
      
      <div v-if="downloadUrl" class="space-y-4">
        <a :href="downloadUrl" download class="btn-primary inline-block">
          Download Now
        </a>
        <p class="text-xs text-gray-500">
          Your download link will expire in 1 hour
        </p>
      </div>
      
      <div v-else-if="errorMessage" class="space-y-4">
        <div class="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-800">{{ errorMessage }}</p>
        </div>
        <NuxtLink :to="`/editor?id=${documentId}`" class="btn-primary inline-block">
          Back to Editor
        </NuxtLink>
      </div>

      <div v-else class="py-4">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        <p class="text-sm text-gray-500 mt-2">Generating your PDF...</p>
      </div>

      <div class="mt-8 pt-6 border-t border-gray-200">
        <NuxtLink to="/" class="text-sm text-primary-600 hover:text-primary-700">
          ← Edit another PDF
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const downloadUrl = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const documentId = route.query.documentId as string

onMounted(async () => {
  if (!documentId) {
    navigateTo('/')
    return
  }

  try {
    const result = await $fetch<{ success: boolean; downloadUrl: string }>('/api/generate', {
      method: 'POST',
      body: { documentId },
    })

    if (result.downloadUrl) {
      downloadUrl.value = result.downloadUrl
      // Auto-trigger file download
      const a = document.createElement('a')
      a.href = result.downloadUrl
      a.download = `tappdf-${documentId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }
  catch (err: any) {
    errorMessage.value = err.data?.message || 'Failed to generate your PDF. Please contact support.'
  }
})
</script>
