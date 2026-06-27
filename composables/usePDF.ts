/**
 * Composable for PDF.js integration
 * Handles PDF loading, rendering, and page navigation
 */

import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

export interface PDFState {
  currentPage: number
  totalPages: number
  scale: number
  loading: boolean
  error: string | null
  url: string | null
}

// Module-level singleton — shared across all components
const _state = reactive<PDFState>({
  currentPage: 1,
  totalPages: 0,
  scale: 1.0,
  loading: false,
  error: null,
  url: null,
})
let _pdfDocument: PDFDocumentProxy | null = null
// Track the active PDF.js render task so we can cancel it before starting a new one
let _currentRenderTask: { cancel: () => void } | null = null

export function usePDF() {
  // Keep PDF document separate from reactive state to avoid proxy issues
  const pdfDocument = {
    get value() { return _pdfDocument },
    set value(v) { _pdfDocument = v },
  }
  
  const state = _state

  // Configure PDF.js worker
  if (process.client) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  }

  /**
   * Load PDF from URL
   */
  async function loadPDF(url: string): Promise<boolean> {
    state.loading = true
    state.error = null

    try {
      const loadingTask = pdfjsLib.getDocument(url)
      const pdfDoc = await loadingTask.promise

      pdfDocument.value = pdfDoc
      state.totalPages = pdfDoc.numPages
      state.currentPage = 1
      state.url = url

      return true
    }
    catch (error: any) {
      console.error('Failed to load PDF:', error)
      state.error = error.message || 'Failed to load PDF'
      return false
    }
    finally {
      state.loading = false
    }
  }

  /**
   * Get a specific page
   */
  async function getPage(pageNumber: number): Promise<PDFPageProxy | null> {
    if (!pdfDocument.value || pageNumber < 1 || pageNumber > state.totalPages) {
      return null
    }

    try {
      return await pdfDocument.value.getPage(pageNumber)
    }
    catch (error) {
      console.error('Failed to get page:', error)
      return null
    }
  }

  /**
   * Render page to canvas
   */
  async function renderPage(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale: number = state.scale,
  ): Promise<boolean> {
    // Cancel any render that is still in progress on this canvas
    if (_currentRenderTask) {
      _currentRenderTask.cancel()
      _currentRenderTask = null
    }

    const page = await getPage(pageNumber)
    if (!page)
      return false

    try {
      const viewport = page.getViewport({ scale })
      const context = canvas.getContext('2d')

      if (!context) {
        console.error('Failed to get canvas context')
        return false
      }

      canvas.width = viewport.width
      canvas.height = viewport.height

      const renderTask = page.render({ canvasContext: context, viewport })
      _currentRenderTask = renderTask

      await renderTask.promise
      _currentRenderTask = null
      return true
    }
    catch (error: unknown) {
      _currentRenderTask = null
      // RenderingCancelledException is expected when a new render supersedes this one
      if ((error as { name?: string })?.name === 'RenderingCancelledException') {
        return false
      }
      console.error('Failed to render page:', error)
      return false
    }
  }

  /**
   * Go to next page
   */
  function nextPage() {
    if (state.currentPage < state.totalPages) {
      state.currentPage++
    }
  }

  /**
   * Go to previous page
   */
  function previousPage() {
    if (state.currentPage > 1) {
      state.currentPage--
    }
  }

  /**
   * Go to specific page
   */
  function goToPage(pageNumber: number) {
    if (pageNumber >= 1 && pageNumber <= state.totalPages) {
      state.currentPage = pageNumber
    }
  }

  /**
   * Set zoom scale
   */
  function setScale(scale: number) {
    state.scale = Math.max(0.5, Math.min(3.0, scale))
  }

  /**
   * Zoom in
   */
  function zoomIn() {
    setScale(state.scale + 0.25)
  }

  /**
   * Zoom out
   */
  function zoomOut() {
    setScale(state.scale - 0.25)
  }

  /**
   * Reset zoom
   */
  function resetZoom() {
    state.scale = 1.0
  }

  /**
   * Get page dimensions
   */
  async function getPageDimensions(pageNumber: number): Promise<{ width: number, height: number } | null> {
    const page = await getPage(pageNumber)
    if (!page)
      return null

    const viewport = page.getViewport({ scale: 1 })
    return {
      width: viewport.width,
      height: viewport.height,
    }
  }

  /**
   * Unload PDF and cleanup
   */
  async function unload() {
    if (pdfDocument.value) {
      await pdfDocument.value.destroy()
      pdfDocument.value = null
    }
    state.currentPage = 1
    state.totalPages = 0
    state.error = null
    state.url = null
  }

  return {
    state,
    loadPDF,
    getPage,
    renderPage,
    nextPage,
    previousPage,
    goToPage,
    setScale,
    zoomIn,
    zoomOut,
    resetZoom,
    getPageDimensions,
    unload,
  }
}
