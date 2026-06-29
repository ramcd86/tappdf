<template>
  <header
    class="bg-gray-900 sticky top-0 z-50"
    data-preserve-canvas-selection
  >
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
          :disabled="isAddingPage || isDeletingPage || !documentId"
          @click="emit('add-page')"
        >
          <span v-if="isAddingPage">Adding...</span>
          <span v-else>+ Add Page</span>
        </button>
        <button
          class="px-3 py-1 text-sm rounded text-pink-400 hover:bg-pink-900/20 disabled:opacity-50"
          :disabled="isAddingPage || isDeletingPage || pdf.state.totalPages <= 1 || pdf.state.currentPage === 1 || !documentId"
          @click="emit('delete-page')"
        >
          <span v-if="isDeletingPage">Deleting...</span>
          <span v-else>Delete Page</span>
        </button>
        <button
          class="btn-primary"
          :disabled="!documentId || isDownloading"
          @click="emit('download')"
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
            @click="emit('toggle-text-style', 'bold')"
          >
            <span class="font-bold">B</span>
          </button>
          <button
            title="Italic"
            class="px-3 py-1 text-sm border border-gray-600 rounded hover:bg-gray-700 transition-colors text-gray-300"
            :class="{ 'bg-gray-700 border-primary-500 text-primary-300': textFormatting.isItalic }"
            @click="emit('toggle-text-style', 'italic')"
          >
            <span class="italic">I</span>
          </button>
          <button
            title="Underline"
            class="px-3 py-1 text-sm border border-gray-600 rounded hover:bg-gray-700 transition-colors text-gray-300"
            :class="{ 'bg-gray-700 border-primary-500 text-primary-300': textFormatting.isUnderline }"
            @click="emit('toggle-text-decoration', 'underline')"
          >
            <span class="underline">U</span>
          </button>
          <button
            title="Strikethrough"
            class="px-3 py-1 text-sm border border-gray-600 rounded hover:bg-gray-700 transition-colors text-gray-300"
            :class="{ 'bg-gray-700 border-primary-500 text-primary-300': textFormatting.isStrikethrough }"
            @click="emit('toggle-text-decoration', 'line-through')"
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
            @click="emit('update-text-formatting', { align: 'left' })"
          >
            ⬅️
          </button>
          <button
            title="Align Center"
            class="px-2 py-1 text-sm border border-gray-600 rounded hover:bg-gray-700 transition-colors text-gray-300"
            :class="{ 'bg-gray-700 border-primary-500': textFormatting.align === 'center' }"
            @click="emit('update-text-formatting', { align: 'center' })"
          >
            ↔️
          </button>
          <button
            title="Align Right"
            class="px-2 py-1 text-sm border border-gray-600 rounded hover:bg-gray-700 transition-colors text-gray-300"
            :class="{ 'bg-gray-700 border-primary-500': textFormatting.align === 'right' }"
            @click="emit('update-text-formatting', { align: 'right' })"
          >
            ➡️
          </button>
        </div>

        <div class="w-px h-6 bg-gray-600" />

        <!-- Font Family Selector -->
        <select
          :value="textFormatting.fontFamily || 'Arial'"
          class="px-3 py-1 text-sm border border-gray-600 rounded bg-gray-700 text-gray-200"
          @change="onFontChange"
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
          @change="onFontSizeChange"
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
          @input="onColorChange"
        >

        <div class="w-px h-6 bg-gray-600" />

        <label class="text-xs text-gray-400">W</label>
        <input
          title="Text width"
          type="number"
          min="1"
          step="1"
          :value="textFormatting.width"
          class="w-16 px-2 py-1 text-sm border border-gray-600 rounded bg-gray-700 text-gray-200"
          @change="onTextWidthChange"
        >
        <label class="text-xs text-gray-400">H</label>
        <input
          title="Text height"
          type="number"
          min="1"
          step="1"
          :value="textFormatting.height"
          class="w-16 px-2 py-1 text-sm border border-gray-600 rounded bg-gray-700 text-gray-200"
          @change="onTextHeightChange"
        >
        <label class="text-xs text-gray-400">Rotate</label>
        <input
          title="Text rotation"
          type="number"
          step="1"
          :value="textFormatting.rotation"
          class="w-16 px-2 py-1 text-sm border border-gray-600 rounded bg-gray-700 text-gray-200"
          @change="onTextRotationChange"
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
          @input="onShapeStrokeColor"
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
          @input="onShapeStrokeWidth"
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
            @change="onShapeFillToggle"
          >
          <input
            v-if="shapeFormatting.fillColor !== 'transparent'"
            title="Fill colour"
            type="color"
            :value="shapeFormatting.fillColor"
            class="w-8 h-8 border border-gray-600 rounded cursor-pointer bg-gray-700"
            @input="onShapeFillColor"
          >
        </template>

        <div class="w-px h-6 bg-gray-600" />

        <!-- Opacity -->
        <label class="text-xs text-gray-400">Opacity</label>
        <input
          :value="Math.round(shapeFormatting.opacity * 100)"
          type="range"
          min="5"
          max="100"
          step="5"
          class="w-24"
          @input="onShapeOpacity"
        >
        <span class="text-xs text-gray-500 w-7 text-right">{{ Math.round(shapeFormatting.opacity * 100) }}%</span>
      </template>

      <template v-else-if="imageFormatting">
        <span class="text-xs font-medium text-gray-400 uppercase">Image:</span>

        <label class="text-xs text-gray-400">Opacity</label>
        <input
          :value="Math.round(imageFormatting.opacity * 100)"
          type="range"
          min="5"
          max="100"
          step="5"
          class="w-24"
          @input="onImageOpacity"
        >
        <span class="text-xs text-gray-500 w-7 text-right">{{ Math.round(imageFormatting.opacity * 100) }}%</span>

        <div class="w-px h-6 bg-gray-600" />

        <label class="text-xs text-gray-400">W</label>
        <input
          title="Image width"
          type="number"
          min="1"
          step="1"
          :value="imageFormatting.width"
          class="w-16 px-2 py-1 text-sm border border-gray-600 rounded bg-gray-700 text-gray-200"
          @change="onImageWidthChange"
        >
        <label class="text-xs text-gray-400">H</label>
        <input
          title="Image height"
          type="number"
          min="1"
          step="1"
          :value="imageFormatting.height"
          class="w-16 px-2 py-1 text-sm border border-gray-600 rounded bg-gray-700 text-gray-200"
          @change="onImageHeightChange"
        >
        <label class="text-xs text-gray-400">Rotate</label>
        <input
          title="Image rotation"
          type="number"
          step="1"
          :value="imageFormatting.rotation"
          class="w-16 px-2 py-1 text-sm border border-gray-600 rounded bg-gray-700 text-gray-200"
          @change="onImageRotationChange"
        >
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
          @input="onPageBackgroundChange"
        >
        <button
          class="px-2 py-0.5 text-xs border border-gray-600 rounded text-gray-400 hover:bg-gray-700"
          @click="emit('update-page-background', '#ffffff')"
        >
          Reset
        </button>
      </span>

      <!-- Layer order controls — visible whenever any element is selected -->
      <template v-if="hasSelectionState">
        <div class="w-px h-6 bg-gray-600 ml-auto" />
        <div class="flex gap-1">
          <button
            title="Bring Forward"
            class="px-2 py-1 text-sm border border-gray-600 rounded hover:bg-gray-700 transition-colors text-gray-300"
            @click="emit('bring-forward')"
          >
            ↑
          </button>
          <button
            title="Send Backward"
            class="px-2 py-1 text-sm border border-gray-600 rounded hover:bg-gray-700 transition-colors text-gray-300"
            @click="emit('send-backward')"
          >
            ↓
          </button>
        </div>
      </template>
    </div>
  </header>
</template>

<script setup lang="ts">
import { selectedFormattingState, selectedShapeFormattingState, selectedImageFormattingState, currentPageBackgroundState, hasSelectionState } from '~/composables/useOverlay'

const _props = defineProps<{
  documentId: string | undefined
  isAddingPage: boolean
  isDeletingPage: boolean
  isDownloading: boolean
}>()

const emit = defineEmits<{
  'add-page': []
  'delete-page': []
  'download': []
  'toggle-text-style': [style: 'bold' | 'italic']
  'toggle-text-decoration': [decoration: 'underline' | 'line-through']
  'update-text-formatting': [props: Record<string, unknown>]
  'update-text-color': [color: string]
  'update-shape-formatting': [props: { strokeWidth?: number, strokeColor?: string, fillColor?: string, opacity?: number }]
  'update-image-formatting': [props: { opacity?: number, width?: number, height?: number, rotation?: number }]
  'update-page-background': [color: string]
  'bring-forward': []
  'send-backward': []
}>()

const pdf = usePDF()
const textFormatting = selectedFormattingState
const shapeFormatting = selectedShapeFormattingState
const imageFormatting = selectedImageFormattingState
const pageBackground = currentPageBackgroundState

const fontFamilies = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Comic Sans MS', 'Impact']
const fontSizes = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96]

function parseNumberInput(event: Event, fallback: number): number {
  const value = Number((event.target as HTMLInputElement).value)
  return Number.isFinite(value) ? value : fallback
}

function onFontChange(event: Event) {
  emit('update-text-formatting', { fontFamily: (event.target as HTMLSelectElement).value })
}

function onFontSizeChange(event: Event) {
  emit('update-text-formatting', { fontSize: parseInt((event.target as HTMLSelectElement).value, 10) })
}

function onColorChange(event: Event) {
  emit('update-text-color', (event.target as HTMLInputElement).value)
}

function onTextWidthChange(event: Event) {
  emit('update-text-formatting', { width: Math.max(1, parseNumberInput(event, textFormatting.value?.width || 1)) })
}

function onTextHeightChange(event: Event) {
  emit('update-text-formatting', { height: Math.max(1, parseNumberInput(event, textFormatting.value?.height || 1)) })
}

function onTextRotationChange(event: Event) {
  emit('update-text-formatting', { rotation: parseNumberInput(event, textFormatting.value?.rotation || 0) })
}

function onShapeStrokeColor(event: Event) {
  emit('update-shape-formatting', { strokeColor: (event.target as HTMLInputElement).value })
}

function onShapeStrokeWidth(event: Event) {
  emit('update-shape-formatting', { strokeWidth: parseFloat((event.target as HTMLInputElement).value) })
}

function onShapeFillToggle(event: Event) {
  emit('update-shape-formatting', { fillColor: (event.target as HTMLInputElement).checked ? '#ffffff' : 'transparent' })
}

function onShapeFillColor(event: Event) {
  emit('update-shape-formatting', { fillColor: (event.target as HTMLInputElement).value })
}

function onShapeOpacity(event: Event) {
  emit('update-shape-formatting', { opacity: parseInt((event.target as HTMLInputElement).value, 10) / 100 })
}

function onImageOpacity(event: Event) {
  emit('update-image-formatting', { opacity: parseInt((event.target as HTMLInputElement).value, 10) / 100 })
}

function onImageWidthChange(event: Event) {
  emit('update-image-formatting', { width: Math.max(1, parseNumberInput(event, imageFormatting.value?.width || 1)) })
}

function onImageHeightChange(event: Event) {
  emit('update-image-formatting', { height: Math.max(1, parseNumberInput(event, imageFormatting.value?.height || 1)) })
}

function onImageRotationChange(event: Event) {
  emit('update-image-formatting', { rotation: parseNumberInput(event, imageFormatting.value?.rotation || 0) })
}

function onPageBackgroundChange(event: Event) {
  emit('update-page-background', (event.target as HTMLInputElement).value)
}
</script>
