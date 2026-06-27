<template>
  <div class="min-h-screen">
    <header class="bg-gray-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center">
        <h1 class="logo-text logo-text--hero">
          tapPDF
        </h1>
        <p class="mt-4 text-base italic font-medium" style="color: #c084fc; letter-spacing: 0.04em;">
          Quick PDF editing with one-time payment
        </p>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="card max-w-2xl mx-auto text-center">
        <h2 class="text-2xl font-semibold mb-4 text-gray-100">
          Edit Your PDF in Seconds
        </h2>
        <p class="text-gray-400 mb-8">
          Upload a PDF, make your edits, and download for just €0.99. No account needed.
        </p>

        <div class="space-y-4">
          <button
            :disabled="creating"
            class="btn-primary w-full max-w-md mx-auto block"
            @click="createBlankPDF"
          >
            <span v-if="!creating">Create New PDF (A4)</span>
            <span v-else>Creating...</span>
          </button>

          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-700" />
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-gray-800 text-gray-400">or</span>
            </div>
          </div>

          <UploadZone />
        </div>

        <div class="mt-8 pt-8">
          <h3 class="text-lg font-medium mb-4 text-gray-200">
            How it works
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div>
              <div class="text-2xl font-bold text-primary-400 mb-2">
                1
              </div>
              <h4 class="font-medium mb-1 text-gray-200">
                Upload
              </h4>
              <p class="text-sm text-gray-400">
                Drop your PDF or click to upload
              </p>
            </div>
            <div>
              <div class="text-2xl font-bold text-primary-400 mb-2">
                2
              </div>
              <h4 class="font-medium mb-1 text-gray-200">
                Edit
              </h4>
              <p class="text-sm text-gray-400">
                Add text, images, and more
              </p>
            </div>
            <div>
              <div class="text-2xl font-bold text-primary-400 mb-2">
                3
              </div>
              <h4 class="font-medium mb-1 text-gray-200">
                Download
              </h4>
              <p class="text-sm text-gray-400">
                Pay once and get your PDF
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer class="mt-auto py-8 text-center text-sm text-gray-500">
      <p>© 2026 tapPDF. Simple PDF editing without the hassle.</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
const creating = ref(false)

async function createBlankPDF() {
  try {
    creating.value = true
    const response = await $fetch('/api/create-blank', {
      method: 'POST',
      body: { pages: 1, pageSize: 'A4' },
    })
    
    // Navigate to editor with new document
    navigateTo(`/editor?id=${response.documentId}`)
  }
  catch (error) {
    console.error('Failed to create blank PDF:', error)
    alert('Failed to create PDF. Please try again.')
  }
  finally {
    creating.value = false
  }
}
</script>
