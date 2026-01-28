<template>
  <div class="min-h-screen flex flex-col">
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-full px-4 py-3 flex items-center justify-between">
        <NuxtLink to="/" class="text-xl font-bold text-gray-900">
          tapPDF
        </NuxtLink>
        
        <div class="flex items-center gap-4">
          <PageNavigator />
          <button class="btn-primary">
            Download PDF
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 flex">
      <!-- Toolbar -->
      <aside class="w-64 bg-white border-r border-gray-200 p-4">
        <Toolbar />
      </aside>

      <!-- Main editor area -->
      <main class="flex-1 bg-gray-100 overflow-auto">
        <div class="p-8">
          <div class="max-w-4xl mx-auto">
            <PDFViewer />
            <OverlayCanvas />
          </div>
        </div>
      </main>
    </div>

    <PaymentModal />
  </div>
</template>

<script setup lang="ts">
// Main PDF editor page
const route = useRoute()
const documentId = route.query.id as string

if (!documentId) {
  navigateTo('/')
}
</script>
