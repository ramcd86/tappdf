<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <EditorHeader
      :document-id="documentId"
      :is-adding-page="isAddingPage"
      :is-deleting-page="isDeletingPage"
      :is-downloading="isDownloading"
      @add-page="handleAddPage"
      @delete-page="handleDeletePage"
      @download="handleDownload"
      @toggle-text-style="handleToggleTextStyle"
      @toggle-text-decoration="handleToggleTextDecoration"
      @update-text-formatting="handleUpdateTextFormatting"
      @update-text-color="(color: string) => overlayCanvas?.updateTextColor(color)"
      @update-shape-formatting="handleUpdateShapeFormatting"
      @update-image-formatting="handleUpdateImageFormatting"
      @update-page-background="(color: string) => overlayCanvas?.setPageBackground(color)"
      @bring-forward="() => overlayCanvas?.bringForward()"
      @send-backward="() => overlayCanvas?.sendBackward()"
    />

    <div class="flex-1 flex overflow-hidden">
      <!-- Toolbar -->
      <aside class="w-64 bg-gray-900 p-4 overflow-y-auto flex-shrink-0">
        <Toolbar
          @add-text="handleAddText"
          @add-image="handleAddImage"
          @add-shape="handleAddShape"
          @select-mode="handleSelectMode"
        />
      </aside>

      <!-- Main editor area -->
      <main class="flex-1 overflow-auto editor-canvas-bg">
        <div class="p-8">
          <div class="flex justify-center">
            <div class="relative inline-block">
              <PDFViewer
                v-if="documentId"
                :document-id="documentId"
                @loaded="handlePDFLoaded"
              />
              <OverlayCanvas
                v-if="pdfDimensions.width > 0"
                ref="overlayCanvas"
                :width="pdfDimensions.width"
                :height="pdfDimensions.height"
                :scale="pdfScale"
              />
            </div>
          </div>
        </div>
      </main>
    </div>

    <PaymentModal
      ref="paymentModal"
      :document-id="documentId || ''"
    />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'PDF Editor',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
const route = useRoute()
const documentId = route.query.id as string

if (!documentId) {
  navigateTo('/')
}

interface OverlayCanvasRef {
  switchPage(page: number): void
  deletePageOverlays(pageIndex: number): void
  addText(text: string, options?: Record<string, unknown>): void
  addImage(url: string): void
  addRectangle(options?: Record<string, unknown>): void
  addCircle(options?: Record<string, unknown>): void
  addLine(options?: Record<string, unknown>): void
  addTriangle(options?: Record<string, unknown>): void
  deleteSelected(): void
  setSelectMode(active: boolean): void
  setPageBackground(color: string): void
  updateShapeFormatting(props: { strokeWidth?: number, strokeColor?: string, fillColor?: string, opacity?: number }): void
  updateImageFormatting(props: { opacity: number }): void
  toggleTextStyle(style: string): void
  toggleTextDecoration(decoration: string): void
  updateTextFormatting(props: Record<string, unknown>): void
  updateTextColor(color: string): void
  getOverlaysJSON(): string
  bringForward(): void
  sendBackward(): void
}

interface PaymentModalRef {
  open(): void
}

const overlayCanvas = ref<OverlayCanvasRef | null>(null)
const paymentModal = ref<PaymentModalRef | null>(null)
const pdfDimensions = ref({ width: 0, height: 0 })
const pdfScale = ref(1)
const isDownloading = ref(false)
const isAddingPage = ref(false)
const isDeletingPage = ref(false)

const pdf = usePDF()

function handlePDFLoaded(dimensions: { width: number, height: number, scale: number }) {
  pdfDimensions.value = { width: dimensions.width, height: dimensions.height }
  pdfScale.value = dimensions.scale
}

function withCacheBust(url: string): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}t=${Date.now()}`
}

// When the PDF page changes, switch the overlay canvas to show only that page's elements
watch(() => pdf.state.currentPage, (newPage) => {
  if (newPage <= 0 || !overlayCanvas.value) return
  overlayCanvas.value?.switchPage(newPage - 1) // PDF page is 1-indexed, overlay is 0-indexed
}, { immediate: false })

function handleToggleTextStyle(style: 'bold' | 'italic') {
  overlayCanvas.value?.toggleTextStyle(style)
}

function handleToggleTextDecoration(decoration: 'underline' | 'line-through') {
  overlayCanvas.value?.toggleTextDecoration(decoration)
}

function handleUpdateTextFormatting(properties: Record<string, unknown>) {
  overlayCanvas.value?.updateTextFormatting(properties)
}

function handleAddText(options: { fontSize: number, color: string }) {
  if (!overlayCanvas.value) {
    console.error('❌ overlayCanvas ref is null!')
    return
  }
  overlayCanvas.value.addText('New Text', {
    fontSize: options.fontSize,
    fill: options.color,
  })
}

function handleAddImage(imageUrl: string) {
  overlayCanvas.value?.addImage(imageUrl)
}

function handleAddShape(type: 'rectangle' | 'circle' | 'triangle' | 'line') {
  if (type === 'rectangle') {
    overlayCanvas.value?.addRectangle()
  }
  else if (type === 'circle') {
    overlayCanvas.value?.addCircle()
  }
  else if (type === 'triangle') {
    overlayCanvas.value?.addTriangle()
  }
  else if (type === 'line') {
    overlayCanvas.value?.addLine()
  }
}

function handleSelectMode(active: boolean) {
  overlayCanvas.value?.setSelectMode(active)
}

async function handleAddPage() {
  if (!documentId || isAddingPage.value || isDeletingPage.value) return
  isAddingPage.value = true
  try {
    const result = await $fetch<{ pageCount: number, uploadUrl: string }>(`/api/document/${documentId}/add-page`, { method: 'POST' })
    if (result.pageCount && result.uploadUrl) {
      await pdf.loadPDF(withCacheBust(result.uploadUrl))
      pdf.goToPage(result.pageCount)
    }
  }
  catch (error) {
    console.error('Failed to add page:', error)
  }
  finally {
    isAddingPage.value = false
  }
}

async function handleDeletePage() {
  if (!documentId || pdf.state.totalPages <= 1 || isAddingPage.value || isDeletingPage.value) return
  isDeletingPage.value = true
  try {
    const pageIndex = pdf.state.currentPage - 1 // convert to 0-based
    overlayCanvas.value?.deletePageOverlays(pageIndex)
    const result = await $fetch<{ pageCount: number, uploadUrl: string }>(`/api/document/${documentId}/delete-page`, {
      method: 'POST',
      body: { pageIndex },
    })
    if (result.pageCount && result.uploadUrl) {
      const targetPage = Math.min(pdf.state.currentPage, result.pageCount)
      await pdf.loadPDF(withCacheBust(result.uploadUrl))
      pdf.goToPage(targetPage)
      // Explicitly switch the overlay canvas to the target page — necessary when
      // currentPage doesn't change value (e.g. deleting page 2 while on page 1)
      // because the watcher only fires on value changes.
      await nextTick()
      overlayCanvas.value?.switchPage(targetPage - 1)
    }
  }
  catch (error) {
    console.error('Failed to delete page:', error)
  }
  finally {
    isDeletingPage.value = false
  }
}

function handleUpdateShapeFormatting(props: { strokeWidth?: number, strokeColor?: string, fillColor?: string, opacity?: number }) {
  overlayCanvas.value?.updateShapeFormatting(props)
}

function handleUpdateImageFormatting(props: { opacity: number }) {
  overlayCanvas.value?.updateImageFormatting(props)
}

async function handleDownload() {
  if (!documentId) return

  isDownloading.value = true
  try {
    // Serialize current canvas state
    const overlayJSON = overlayCanvas.value?.getOverlaysJSON()
    const overlays = overlayJSON ? JSON.parse(overlayJSON) : []

    // Persist overlays to server before opening payment
    await $fetch(`/api/overlay/${documentId}`, {
      method: 'POST',
      body: { overlays },
    })

    // Open payment modal
    paymentModal.value?.open()
  }
  catch (error) {
    console.error('Failed to prepare download:', error)
  }
  finally {
    isDownloading.value = false
  }
}
</script>

<style scoped>
.editor-canvas-bg {
  background-color: #030712;
  background-image: url("data:image/svg+xml,%3Csvg width='8' height='8' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='8' height='8' fill='%23111827'/%3E%3Crect x='8' y='8' width='8' height='8' fill='%23111827'/%3E%3C/svg%3E");
}
</style>
