<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <header class="bg-gray-900 sticky top-0 z-50">
      <div class="max-w-full px-4 py-3 flex items-center justify-between">
        <NuxtLink
          to="/"
          class="logo-text"
        >
          tapPDF
        </NuxtLink>

        <div class="flex items-center gap-4">
          <PageNavigator />
          <button
            class="px-3 py-1 text-sm rounded hover:bg-gray-700 disabled:opacity-50 text-gray-300"
            :disabled="isAddingPage || !documentId"
            @click="handleAddPage"
          >
            <span v-if="isAddingPage">Adding...</span>
            <span v-else>+ Add Page</span>
          </button>
          <button
            class="px-3 py-1 text-sm rounded text-pink-400 hover:bg-pink-900/20 disabled:opacity-50"
            :disabled="isDeletingPage || pdf.state.totalPages <= 1 || pdf.state.currentPage === 1 || !documentId"
            @click="handleDeletePage"
          >
            <span v-if="isDeletingPage">Deleting...</span>
            <span v-else>Delete Page</span>
          </button>
          <button
            class="btn-primary"
            :disabled="!documentId || isDownloading"
            @click="handleDownload"
          >
            <span v-if="isDownloading">Saving...</span>
            <span v-else>Save &amp; Download</span>
          </button>
        </div>
      </div>

      <!-- Formatting Bar -->
      <div class="bg-gray-800 px-4 py-2 flex items-center gap-4 h-[50px]">
        <template v-if="textFormatting">
          <span class="text-xs font-medium text-gray-400 uppercase">Text Format:</span>

          <!-- Style Buttons -->
          <div class="flex gap-1">
            <button
              title="Bold"
              class="px-3 py-1 text-sm border border-gray-600 rounded hover:bg-gray-700 transition-colors text-gray-300"
              :class="{ 'bg-gray-700 border-primary-500 text-primary-300': textFormatting.isBold }"
              @click="handleToggleTextStyle('bold')"
            >
              <span class="font-bold">B</span>
            </button>
            <button
              title="Italic"
              class="px-3 py-1 text-sm border border-gray-600 rounded hover:bg-gray-700 transition-colors text-gray-300"
              :class="{ 'bg-gray-700 border-primary-500 text-primary-300': textFormatting.isItalic }"
              @click="handleToggleTextStyle('italic')"
            >
              <span class="italic">I</span>
            </button>
            <button
              title="Underline"
              class="px-3 py-1 text-sm border border-gray-600 rounded hover:bg-gray-700 transition-colors text-gray-300"
              :class="{ 'bg-gray-700 border-primary-500 text-primary-300': textFormatting.isUnderline }"
              @click="handleToggleTextDecoration('underline')"
            >
              <span class="underline">U</span>
            </button>
            <button
              title="Strikethrough"
              class="px-3 py-1 text-sm border border-gray-600 rounded hover:bg-gray-700 transition-colors text-gray-300"
              :class="{ 'bg-gray-700 border-primary-500 text-primary-300': textFormatting.isStrikethrough }"
              @click="handleToggleTextDecoration('line-through')"
            >
              <span class="line-through">S</span>
            </button>
          </div>

          <div class="w-px h-6 bg-gray-600" />

          <!-- Alignment Buttons -->
          <div class="flex gap-1">
            <button
              title="Align Left"
              class="px-2 py-1 text-sm border border-gray-600 rounded hover:bg-gray-700 transition-colors text-gray-300"
              :class="{ 'bg-gray-700 border-primary-500': textFormatting.align === 'left' }"
              @click="handleUpdateTextFormatting({ align: 'left' })"
            >
              ⬅️
            </button>
            <button
              title="Align Center"
              class="px-2 py-1 text-sm border border-gray-600 rounded hover:bg-gray-700 transition-colors text-gray-300"
              :class="{ 'bg-gray-700 border-primary-500': textFormatting.align === 'center' }"
              @click="handleUpdateTextFormatting({ align: 'center' })"
            >
              ↔️
            </button>
            <button
              title="Align Right"
              class="px-2 py-1 text-sm border border-gray-600 rounded hover:bg-gray-700 transition-colors text-gray-300"
              :class="{ 'bg-gray-700 border-primary-500': textFormatting.align === 'right' }"
              @click="handleUpdateTextFormatting({ align: 'right' })"
            >
              ➡️
            </button>
          </div>

          <div class="w-px h-6 bg-gray-600" />

          <!-- Font Family Selector -->
          <select
            :value="textFormatting.fontFamily || 'Arial'"
            class="px-3 py-1 text-sm border border-gray-600 rounded bg-gray-700 text-gray-200"
            @change="handleFontChange"
          >
            <option
              v-for="font in fontFamilies"
              :key="font"
              :value="font"
            >
              {{ font }}
            </option>
          </select>

          <!-- Font Size -->
          <select
            title="Font Size"
            :value="textFormatting.fontSize || 16"
            class="px-2 py-1 text-sm border border-gray-600 rounded bg-gray-700 text-gray-200"
            @change="handleFontSizeChange"
          >
            <option
              v-for="size in fontSizes"
              :key="size"
              :value="size"
            >
              {{ size }}
            </option>
          </select>

          <!-- Text Color -->
          <input
            title="Text Color"
            type="color"
            :value="textFormatting.color || '#000000'"
            class="w-10 h-8 border border-gray-600 rounded cursor-pointer bg-gray-700"
            @input="handleColorChange"
          >
        </template>

        <template v-else-if="shapeFormatting">
          <span class="text-xs font-medium text-gray-400 uppercase">Shape:</span>

          <!-- Stroke colour -->
          <label class="text-xs text-gray-400">Stroke</label>
          <input
            title="Stroke colour"
            type="color"
            :value="shapeFormatting.strokeColor"
            class="w-8 h-8 border border-gray-600 rounded cursor-pointer bg-gray-700"
            @input="handleShapeStrokeColor"
          >

          <div class="w-px h-6 bg-gray-600" />

          <!-- Stroke width -->
          <label class="text-xs text-gray-400">Thickness</label>
          <input
            :value="shapeFormatting.strokeWidth"
            type="range"
            min="1"
            max="20"
            step="0.5"
            class="w-28"
            @input="handleShapeStrokeWidth"
          >
          <span class="text-xs text-gray-500 w-5 text-right">{{ shapeFormatting.strokeWidth }}</span>

          <div class="w-px h-6 bg-gray-600" />

          <!-- Fill (not for lines) -->
          <template v-if="shapeFormatting.shapeType !== 'line'">
            <div class="w-px h-6 bg-gray-600" />
            <label class="text-xs text-gray-400">Fill</label>
            <input
              title="Toggle fill"
              type="checkbox"
              :checked="shapeFormatting.fillColor !== 'transparent'"
              @change="handleShapeFillToggle"
            >
            <input
              v-if="shapeFormatting.fillColor !== 'transparent'"
              title="Fill colour"
              type="color"
              :value="shapeFormatting.fillColor"
              class="w-8 h-8 border border-gray-600 rounded cursor-pointer bg-gray-700"
              @input="handleShapeFillColor"
            >
          </template>
        </template>

        <span
          v-else
          class="text-xs text-gray-500 italic flex items-center gap-3"
        >
          <span>Page background:</span>
          <input
            title="Page background colour"
            type="color"
            :value="pageBackground"
            class="w-8 h-7 border border-gray-600 rounded cursor-pointer bg-gray-700"
            @input="handlePageBackgroundChange"
          >
          <button
            class="px-2 py-0.5 text-xs border border-gray-600 rounded text-gray-400 hover:bg-gray-700"
            @click="handlePageBackgroundChange({ target: { value: '#ffffff' } } as unknown as Event)"
          >
            Reset
          </button>
        </span>
      </div>
    </header>

    <div class="flex-1 flex overflow-hidden">
      <!-- Toolbar -->
      <aside class="w-64 bg-gray-900 p-4 overflow-y-auto flex-shrink-0">
        <Toolbar
          @add-text="handleAddText"
          @add-image="handleAddImage"
          @add-shape="handleAddShape"
          @add-highlight="handleAddHighlight"
          @select-mode="handleSelectMode"
        />
      </aside>

      <!-- Main editor area -->
      <main class="flex-1 bg-gray-950 overflow-auto">
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
import { selectedFormattingState, selectedShapeFormattingState, currentPageBackgroundState } from '~/composables/useOverlay'

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
  addHighlight(options?: Record<string, unknown>): void
  deleteSelected(): void
  setSelectMode(active: boolean): void
  setPageBackground(color: string): void
  updateShapeFormatting(props: { strokeWidth?: number, strokeColor?: string, fillColor?: string }): void
  toggleTextStyle(style: string): void
  toggleTextDecoration(decoration: string): void
  updateTextFormatting(props: Record<string, unknown>): void
  updateTextColor(color: string): void
  getOverlaysJSON(): string
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
const textFormatting = selectedFormattingState
const shapeFormatting = selectedShapeFormattingState
const pageBackground = currentPageBackgroundState

const fontFamilies = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Comic Sans MS', 'Impact']
const fontSizes = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96]

function handlePDFLoaded(dimensions: { width: number, height: number, scale: number }) {
  pdfDimensions.value = { width: dimensions.width, height: dimensions.height }
  pdfScale.value = dimensions.scale
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

function handleFontChange(event: Event) {
  const target = event.target as HTMLSelectElement
  handleUpdateTextFormatting({ fontFamily: target.value })
}

function handleFontSizeChange(event: Event) {
  const target = event.target as HTMLSelectElement
  handleUpdateTextFormatting({ fontSize: parseInt(target.value, 10) })
}

function handleColorChange(event: Event) {
  const target = event.target as HTMLInputElement
  overlayCanvas.value?.updateTextColor(target.value)
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

function handleAddHighlight() {
  overlayCanvas.value?.addHighlight()
}

function handleSelectMode(active: boolean) {
  overlayCanvas.value?.setSelectMode(active)
}

function handlePageBackgroundChange(event: Event) {
  overlayCanvas.value?.setPageBackground((event.target as HTMLInputElement).value)
}

async function handleAddPage() {
  if (!documentId) return
  isAddingPage.value = true
  try {
    const result = await $fetch<{ pageCount: number }>(`/api/document/${documentId}/add-page`, { method: 'POST' })
    if (result.pageCount && pdf.state.url) {
      // Reload PDF with cache-bust then navigate to the new last page
      await pdf.loadPDF(pdf.state.url + '?t=' + Date.now())
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
  if (!documentId || pdf.state.totalPages <= 1) return
  isDeletingPage.value = true
  try {
    const pageIndex = pdf.state.currentPage - 1 // convert to 0-based
    overlayCanvas.value?.deletePageOverlays(pageIndex)
    const result = await $fetch<{ pageCount: number }>(`/api/document/${documentId}/delete-page`, {
      method: 'POST',
      body: { pageIndex },
    })
    if (result.pageCount && pdf.state.url) {
      const targetPage = Math.min(pdf.state.currentPage, result.pageCount)
      await pdf.loadPDF(pdf.state.url + '?t=' + Date.now())
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

function handleUpdateShapeFormatting(props: { strokeWidth?: number, strokeColor?: string, fillColor?: string }) {
  overlayCanvas.value?.updateShapeFormatting(props)
}

function handleShapeStrokeColor(event: Event) {
  handleUpdateShapeFormatting({ strokeColor: (event.target as HTMLInputElement).value })
}

function handleShapeStrokeWidth(event: Event) {
  handleUpdateShapeFormatting({ strokeWidth: parseFloat((event.target as HTMLInputElement).value) })
}

function handleShapeFillToggle(event: Event) {
  handleUpdateShapeFormatting({ fillColor: (event.target as HTMLInputElement).checked ? '#ffffff' : 'transparent' })
}

function handleShapeFillColor(event: Event) {
  handleUpdateShapeFormatting({ fillColor: (event.target as HTMLInputElement).value })
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
