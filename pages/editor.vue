<template>
  <div class="min-h-screen flex flex-col">
    <header class="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div class="max-w-full px-4 py-3 flex items-center justify-between">
        <NuxtLink to="/" class="text-xl font-bold text-gray-900">
          tapPDF
        </NuxtLink>
        
        <div class="flex items-center gap-4">
          <PageNavigator />
          <button 
            class="btn-primary"
            @click="handleDownload"
            :disabled="!documentId || isDownloading"
          >
            <span v-if="isDownloading">Saving...</span>
            <span v-else>Save &amp; Download</span>
          </button>
        </div>
      </div>

      <!-- Text Formatting Bar (always present) -->
      <div 
        class="border-t border-gray-200 bg-gray-50 px-4 py-2 flex items-center gap-4 h-[50px]"
      >
        <template v-if="textFormatting">
          <span class="text-xs font-medium text-gray-600 uppercase">Text Format:</span>
        
        <!-- Style Buttons -->
        <div class="flex gap-1">
          <button
            class="px-3 py-1 text-sm border rounded hover:bg-white transition-colors"
            :class="{ 'bg-white border-primary-500 text-primary-700': textFormatting.isBold }"
            @click="handleToggleTextStyle('bold')"
            title="Bold"
          >
            <span class="font-bold">B</span>
          </button>
          <button
            class="px-3 py-1 text-sm border rounded hover:bg-white transition-colors"
            :class="{ 'bg-white border-primary-500 text-primary-700': textFormatting.isItalic }"
            @click="handleToggleTextStyle('italic')"
            title="Italic"
          >
            <span class="italic">I</span>
          </button>
          <button
            class="px-3 py-1 text-sm border rounded hover:bg-white transition-colors"
            :class="{ 'bg-white border-primary-500 text-primary-700': textFormatting.isUnderline }"
            @click="handleToggleTextDecoration('underline')"
            title="Underline"
          >
            <span class="underline">U</span>
          </button>
          <button
            class="px-3 py-1 text-sm border rounded hover:bg-white transition-colors"
            :class="{ 'bg-white border-primary-500 text-primary-700': textFormatting.isStrikethrough }"
            @click="handleToggleTextDecoration('line-through')"
            title="Strikethrough"
          >
            <span class="line-through">S</span>
          </button>
        </div>

        <div class="w-px h-6 bg-gray-300"></div>

        <!-- Alignment Buttons -->
        <div class="flex gap-1">
          <button
            class="px-2 py-1 text-sm border rounded hover:bg-white transition-colors"
            :class="{ 'bg-white border-primary-500': textFormatting.align === 'left' }"
            @click="handleUpdateTextFormatting({ align: 'left' })"
            title="Align Left"
          >
            ⬅️
          </button>
          <button
            class="px-2 py-1 text-sm border rounded hover:bg-white transition-colors"
            :class="{ 'bg-white border-primary-500': textFormatting.align === 'center' }"
            @click="handleUpdateTextFormatting({ align: 'center' })"
            title="Align Center"
          >
            ↔️
          </button>
          <button
            class="px-2 py-1 text-sm border rounded hover:bg-white transition-colors"
            :class="{ 'bg-white border-primary-500': textFormatting.align === 'right' }"
            @click="handleUpdateTextFormatting({ align: 'right' })"
            title="Align Right"
          >
            ➡️
          </button>
        </div>

        <div class="w-px h-6 bg-gray-300"></div>

        <!-- Font Family Selector -->
        <select
          :value="textFormatting.fontFamily || 'Arial'"
          class="px-3 py-1 text-sm border border-gray-300 rounded bg-white"
          @change="handleFontChange"
        >
          <option value="Arial">Arial</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Georgia">Georgia</option>
          <option value="Courier New">Courier New</option>
          <option value="Verdana">Verdana</option>
          <option value="Tahoma">Tahoma</option>
          <option value="Trebuchet MS">Trebuchet MS</option>
          <option value="Comic Sans MS">Comic Sans MS</option>
          <option value="Impact">Impact</option>
        </select>

        <!-- Font Size -->
        <select
          :value="textFormatting.fontSize || 16"
          class="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
          title="Font Size"
          @change="handleFontSizeChange"
        >
          <option value="8">8</option>
          <option value="10">10</option>
          <option value="12">12</option>
          <option value="14">14</option>
          <option value="16">16</option>
          <option value="18">18</option>
          <option value="20">20</option>
          <option value="24">24</option>
          <option value="28">28</option>
          <option value="32">32</option>
          <option value="36">36</option>
          <option value="48">48</option>
          <option value="64">64</option>
          <option value="72">72</option>
          <option value="96">96</option>
        </select>

        <!-- Text Color -->
        <input
          :value="textFormatting.color || '#000000'"
          type="color"
          class="w-10 h-8 border border-gray-300 rounded cursor-pointer"
          title="Text Color"
          @input="handleColorChange"
        >
        </template>
        <span v-else class="text-xs text-gray-400 italic">Select an element to see formatting options</span>
      </div>
    </header>

    <div class="flex-1 flex">
      <!-- Toolbar -->
      <aside class="w-64 bg-white border-r border-gray-200 p-4">
        <Toolbar 
          @add-text="handleAddText"
          @add-image="handleAddImage"
          @add-shape="handleAddShape"
          @add-highlight="handleAddHighlight"
          @delete-selected="handleDeleteSelected"
          @export-json="handleExportJSON"
        />
      </aside>

      <!-- Main editor area -->
      <main class="flex-1 bg-gray-100 overflow-auto">
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
              />
            </div>
          </div>
        </div>
      </main>
    </div>

    <PaymentModal ref="paymentModal" :document-id="documentId || ''" />
  </div>
</template>

<script setup lang="ts">
import { selectedFormattingState } from '~/composables/useOverlay'

const route = useRoute()
const documentId = route.query.id as string

if (!documentId) {
  navigateTo('/')
}

const overlayCanvas = ref<any>(null)
const paymentModal = ref<any>(null)
const pdfDimensions = ref({ width: 0, height: 0 })
const isDownloading = ref(false)

// Module-level singleton ref \u2014 reacts to Konva click events with zero component-boundary friction
const textFormatting = selectedFormattingState

function handlePDFLoaded(dimensions: { width: number; height: number }) {
  pdfDimensions.value = dimensions
}

function handleToggleTextStyle(style: 'bold' | 'italic') {
  overlayCanvas.value?.toggleTextStyle(style)
}

function handleToggleTextDecoration(decoration: 'underline' | 'line-through') {
  overlayCanvas.value?.toggleTextDecoration(decoration)
}

function handleUpdateTextFormatting(properties: any) {
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

function handleAddText(options: { fontSize: number; color: string }) {
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

function handleAddShape(type: 'rectangle' | 'circle') {
  if (type === 'rectangle') {
    overlayCanvas.value?.addRectangle()
  }
  else {
    overlayCanvas.value?.addCircle()
  }
}

function handleAddHighlight() {
  overlayCanvas.value?.addHighlight()
}

function handleDeleteSelected() {
  overlayCanvas.value?.deleteSelected()
}

function handleExportJSON() {
  const json = overlayCanvas.value?.getOverlaysJSON()
  if (json) {
    console.log('Overlay JSON:', json)
    // Could download or show in modal
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'overlays.json'
    a.click()
  }
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
