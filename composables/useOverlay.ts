/**
 * Composable for overlay state management
 * Handles canvas overlays using Konva.js
 */

import Konva from 'konva'
import type { OverlayObject, OverlayState } from '~/types/overlay'

// Module-level singleton — only one overlay canvas exists at a time.
// Exposed directly so editor.vue can watch it without cross-component ref bridging.
export const selectedFormattingState = ref<{
  isBold: boolean
  isItalic: boolean
  isUnderline: boolean
  isStrikethrough: boolean
  fontFamily: string
  align: string
  fontSize: number
  color: string
} | null>(null)

export const selectedShapeFormattingState = ref<{
  strokeWidth: number
  strokeColor: string
  fillColor: string
  shapeType: string
} | null>(null)

// Reactive page background colour (shown in formatting bar when nothing is selected)
export const currentPageBackgroundState = ref<string>('#ffffff')

export function useOverlay() {
  const state = reactive<OverlayState>({
    objects: [],
    currentPage: 0,
    totalPages: 0,
    scale: 1,
  })

  // Konva stage and layers (not reactive to avoid proxy wrapping)
  let stage: Konva.Stage | null = null
  let layer: Konva.Layer | null = null
  let transformer: Konva.Transformer | null = null
  let keyboardHandler: ((e: KeyboardEvent) => void) | null = null
  let outsideClickHandler: ((e: MouseEvent) => void) | null = null
  let activeTextarea: HTMLTextAreaElement | null = null
  let selectModeActive = false
  // Suppress saveOverlays() calls while loadOverlaysForPage is reconstructing the canvas
  let _loadingOverlays = false

  // Refs for external access
  const stageRef = ref<Konva.Stage | null>(null)

  // Reactive formatting state — updated synchronously by Konva events (replaces polling)
  const selectedFormatting = selectedFormattingState

  function syncFormattingState(node: Konva.Text | null) {
    if (!node) {
      selectedFormatting.value = null
      return
    }
    const fontStyle = node.fontStyle() || ''
    const textDecoration = node.textDecoration() || ''
    const fill = node.fill()
    selectedFormatting.value = {
      isBold: fontStyle.includes('bold'),
      isItalic: fontStyle.includes('italic'),
      isUnderline: textDecoration.includes('underline'),
      isStrikethrough: textDecoration.includes('line-through'),
      fontFamily: node.fontFamily(),
      align: node.align() || 'left',
      fontSize: node.fontSize(),
      color: typeof fill === 'string' ? fill : '#000000',
    }
  }

  function syncShapeFormattingState(node: Konva.Shape | null) {
    if (!node) {
      selectedShapeFormattingState.value = null
      return
    }
    const fill = node.fill()
    const fillColor = (!fill || fill === 'transparent' || fill === 'none' || fill === '')
      ? 'transparent'
      : (typeof fill === 'string' ? fill : '#000000')
    let shapeType = 'shape'
    if (node instanceof Konva.Rect) shapeType = 'rectangle'
    else if (node instanceof Konva.Ellipse) shapeType = 'circle'
    else if (node instanceof Konva.Line) shapeType = (node as Konva.Line).closed() ? 'triangle' : 'line'
    selectedShapeFormattingState.value = {
      strokeWidth: node.strokeWidth(),
      strokeColor: (node.stroke() as string) || '#000000',
      fillColor,
      shapeType,
    }
  }

  /**
   * Initialize Konva.js stage
   */
  function initCanvas(container: HTMLDivElement, width: number, height: number) {
    // Dispose existing stage if any
    if (stage) {
      stage.destroy()
    }

    // Create stage directly with the container div
    stage = new Konva.Stage({
      container,
      width,
      height,
    })
    stageRef.value = stage

    // Single layer for all content and transformer
    layer = new Konva.Layer()
    stage.add(layer)

    // Transformer for resize/rotate handles
    transformer = new Konva.Transformer({
      nodes: [],
      rotateEnabled: true,
      resizeEnabled: true,
      borderStroke: '#a855f7',
      borderStrokeWidth: 2,
      anchorFill: '#a855f7',
      anchorStroke: '#ffffff',
      anchorSize: 12,
      anchorCornerRadius: 6,
      keepRatio: false,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center'],
    })
    layer.add(transformer)

    // Click on empty area or any object — deselect on background, always clear select highlights
    stage.on('click tap', (e) => {
      // Clear select-mode highlights on any click
      if (selectModeActive) {
        clearSelectHighlights()
      }
      if (e.target === stage) {
        transformer?.nodes([])
        syncFormattingState(null)
        selectedShapeFormattingState.value = null
      }
    })

    // Transform events handled below

    // Save overlays when object is modified
    stage.on('dragend transformend', saveOverlays)

    // Handle node transforms — bake scale back into dimensions and fix stroke width
    transformer.on('transformend', () => {
      const node = transformer?.nodes()[0]
      if (node && node instanceof Konva.Text) {
        // Get the scaled dimensions
        const scaleX = node.scaleX()
        const scaleY = node.scaleY()

        // Update the actual dimensions based on scale
        node.width(node.width() * scaleX)

        // Get current height (auto-calculated from content)
        const currentHeight = node.height()
        const newHeight = currentHeight * scaleY

        // Set explicit height (will clip if content exceeds)
        node.height(newHeight)

        // Reset scale to 1
        node.scaleX(1)
        node.scaleY(1)

        layer?.draw()
      }
      else if (node instanceof Konva.Rect) {
        // Bake scale into width/height so the shape stays pixel-perfect
        node.width(node.width() * node.scaleX())
        node.height(node.height() * node.scaleY())
        node.scaleX(1)
        node.scaleY(1)
        layer?.draw()
        syncShapeFormattingState(node)
      }
      else if (node instanceof Konva.Ellipse) {
        // Bake scale into radii — preserves any ellipse aspect ratio
        node.radiusX(node.radiusX() * node.scaleX())
        node.radiusY(node.radiusY() * node.scaleY())
        node.scaleX(1)
        node.scaleY(1)
        layer?.draw()
        syncShapeFormattingState(node)
      }
      else if (node instanceof Konva.Line) {
        // Bake scale into each point coordinate
        const scaleX = node.scaleX()
        const scaleY = node.scaleY()
        node.points(node.points().map((p: number, i: number) => i % 2 === 0 ? p * scaleX : p * scaleY))
        node.scaleX(1)
        node.scaleY(1)
        layer?.draw()
        syncShapeFormattingState(node)
      }
    })

    // Keyboard shortcuts - Delete/Backspace to delete selected object
    keyboardHandler = (e: KeyboardEvent) => {
      // Check if Delete or Backspace was pressed
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete if user is typing in an input/textarea
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return
        }

        // Check if there's a selected object
        const selectedNodes = transformer?.nodes() || []
        if (selectedNodes.length > 0) {
          e.preventDefault() // Prevent browser back navigation on Backspace
          deleteSelected()
        }
      }
    }

    // Add keyboard listener
    window.addEventListener('keydown', keyboardHandler)

    // Deselect when clicking anywhere outside the canvas container
    outsideClickHandler = (e: MouseEvent) => {
      const canvasEl = stage?.container()
      if (canvasEl && !canvasEl.contains(e.target as Node)) {
        transformer?.nodes([])
        syncFormattingState(null)
        selectedShapeFormattingState.value = null
        if (selectModeActive) clearSelectHighlights()
        layer?.draw()
      }
    }
    document.addEventListener('mousedown', outsideClickHandler)

    return stage
  }

  /**
   * Add text overlay
   */
  function addText(text: string = 'New Text', options?: Record<string, unknown>) {
    if (!layer || !transformer)
      return

    const textNode = new Konva.Text({
      x: 100,
      y: 100,
      text,
      fontSize: 24,
      fontFamily: 'Arial',
      fill: '#000000',
      draggable: true,
      name: 'overlay-object',
      width: 200,
      wrap: 'char', // break at any character so text never escapes the box width
      ...options,
    })

    // Select on click — sync text formatting, clear shape formatting
    textNode.on('click tap', () => {
      transformer!.nodes([textNode])
      layer!.draw()
      syncFormattingState(textNode)
      selectedShapeFormattingState.value = null
    })

    // WYSIWYG inline editing on double-click
    textNode.on('dblclick dbltap', () => {
      const textPosition = textNode.getAbsolutePosition()
      const stageBox = stage!.container().getBoundingClientRect()
      const fontStyle = textNode.fontStyle() || ''
      const fill = textNode.fill()

      const textarea = document.createElement('textarea')
      activeTextarea = textarea
      document.body.appendChild(textarea)

      textarea.value = textNode.text()

      // Position: fixed so viewport scroll doesn't offset it
      textarea.style.position = 'fixed'
      textarea.style.top = `${stageBox.top + textPosition.y}px`
      textarea.style.left = `${stageBox.left + textPosition.x}px`
      textarea.style.width = `${textNode.width() + 4}px`
      textarea.style.minHeight = `${textNode.fontSize() * 1.3}px`
      textarea.style.zIndex = '9999'

      // Mirror Konva text styling exactly
      textarea.style.fontSize = `${textNode.fontSize()}px`
      textarea.style.fontFamily = textNode.fontFamily()
      textarea.style.fontWeight = fontStyle.includes('bold') ? 'bold' : 'normal'
      textarea.style.fontStyle = fontStyle.includes('italic') ? 'italic' : 'normal'
      textarea.style.textDecoration = textNode.textDecoration() || 'none'
      textarea.style.textAlign = textNode.align() || 'left'
      textarea.style.color = typeof fill === 'string' ? fill : '#000000'
      textarea.style.lineHeight = `${textNode.lineHeight() || 1.2}`

      // Semi-transparent background + visible border to show the editing boundary
      textarea.style.background = 'rgba(255, 255, 255, 0.85)'
      textarea.style.border = '1px solid rgba(168, 85, 247, 0.8)'
      textarea.style.outline = 'none'
      textarea.style.padding = '2px'
      textarea.style.margin = '0'
      textarea.style.overflow = 'hidden'
      textarea.style.resize = 'none'
      textarea.style.boxSizing = 'border-box'
      textarea.style.wordBreak = 'break-all' // force wrapping of long words/URLs

      // Hide Konva text node while textarea is visible
      textNode.hide()
      layer!.draw()

      // Auto-grow height as user types
      const autoResize = () => {
        textarea.style.height = 'auto'
        textarea.style.height = `${textarea.scrollHeight}px`
      }
      textarea.addEventListener('input', autoResize)
      autoResize()

      textarea.focus()
      textarea.select()

      let removed = false
      const removeTextarea = () => {
        if (removed) return
        removed = true
        activeTextarea = null
        textNode.text(textarea.value || ' ')
        textNode.show()
        layer?.draw() // guard: layer may be null if component unmounted
        textarea.parentNode?.removeChild(textarea)
        syncFormattingState(textNode)
        saveOverlays()
      }

      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          removeTextarea()
        }
        // Enter without shift commits; shift+Enter inserts newline
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          removeTextarea()
        }
      })

      // Delay blur-close by 200ms so toolbar clicks register first
      textarea.addEventListener('blur', () => setTimeout(removeTextarea, 200))
    })

    layer.add(textNode)
    transformer.nodes([textNode])
    syncFormattingState(textNode) // activate toolbar immediately on add
    layer.draw()
    saveOverlays()
  }

  /**
   * Add image overlay
   */
  async function addImage(imageUrl: string, options?: Record<string, unknown>) {
    if (!layer || !transformer)
      return

    // Capture the page at call time so stale loads can be discarded if the
    // user switches pages before the image finishes loading.
    const pageAtCallTime = state.currentPage

    return new Promise<void>((resolve, reject) => {
      const imageObj = new Image()
      // crossOrigin only for HTTP URLs — setting it on data URLs blocks loading
      if (!imageUrl.startsWith('data:')) {
        imageObj.crossOrigin = 'anonymous'
      }

      imageObj.onload = () => {
        // Discard if the user has navigated away from this page
        if (state.currentPage !== pageAtCallTime || !layer) {
          resolve()
          return
        }

        const image = new Konva.Image({
          x: 100,
          y: 100,
          image: imageObj,
          draggable: true,
          name: 'overlay-object',
          ...options,
        })

        const maxWidth = stage!.width() * 0.5
        const maxHeight = stage!.height() * 0.5
        if (image.width() > maxWidth || image.height() > maxHeight) {
          const scale = Math.min(maxWidth / image.width(), maxHeight / image.height())
          image.scale({ x: scale, y: scale })
        }

        image.on('click tap', () => {
          transformer!.nodes([image])
        })

        layer!.add(image)
        transformer!.nodes([image])
        layer!.draw()
        saveOverlays()
        resolve()
      }

      imageObj.onerror = () => reject(new Error('Failed to load image'))

      imageObj.src = imageUrl
    })
  }

  /**
   * Add rectangle shape
   */
  function addRectangle(options?: Record<string, unknown>) {
    if (!layer || !transformer)
      return

    const rect = new Konva.Rect({
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 2,
      strokeScaleEnabled: false,
      draggable: true,
      name: 'overlay-object',
      ...options,
    })

    // Select on click — sync shape formatting, clear text formatting
    rect.on('click tap', () => {
      transformer!.nodes([rect])
      syncShapeFormattingState(rect)
      syncFormattingState(null)
    })

    layer.add(rect)
    transformer.nodes([rect])
    layer.draw()
    saveOverlays()
  }

  /**
   * Add circle/ellipse shape
   */
  function addCircle(options?: Record<string, unknown>) {
    if (!layer || !transformer)
      return

    // Support legacy `radius` option from older saved data
    const { radius, ...rest } = (options || {}) as Record<string, unknown> & { radius?: number }
    const defaultRadius = radius || 50

    const circle = new Konva.Ellipse({
      x: 150,
      y: 150,
      radiusX: defaultRadius,
      radiusY: defaultRadius,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 2,
      strokeScaleEnabled: false,
      draggable: true,
      name: 'overlay-object',
      ...rest,
    })

    // Select on click — sync shape formatting, clear text formatting
    circle.on('click tap', () => {
      transformer!.nodes([circle])
      syncShapeFormattingState(circle)
      syncFormattingState(null)
    })

    layer.add(circle)
    transformer.nodes([circle])
    layer.draw()
    saveOverlays()
  }

  /**
   * Add line shape
   */
  function addLine(options?: Record<string, unknown>) {
    if (!layer || !transformer)
      return

    const line = new Konva.Line({
      x: 100,
      y: 200,
      points: [0, 0, 200, 0],
      stroke: '#000000',
      strokeWidth: 2,
      strokeScaleEnabled: false,
      hitStrokeWidth: 12,
      draggable: true,
      name: 'overlay-object',
      ...options,
    })

    line.on('click tap', () => {
      transformer!.nodes([line])
      syncShapeFormattingState(line)
      syncFormattingState(null)
    })

    layer.add(line)
    transformer.nodes([line])
    layer.draw()
    saveOverlays()
  }

  /**
   * Add triangle shape
   */
  function addTriangle(options?: Record<string, unknown>) {
    if (!layer || !transformer)
      return

    const triangle = new Konva.Line({
      x: 100,
      y: 100,
      points: [50, 0, 100, 86, 0, 86],
      closed: true,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 2,
      strokeScaleEnabled: false,
      draggable: true,
      name: 'overlay-object',
      ...options,
    })

    triangle.on('click tap', () => {
      transformer!.nodes([triangle])
      syncShapeFormattingState(triangle)
      syncFormattingState(null)
    })

    layer.add(triangle)
    transformer.nodes([triangle])
    layer.draw()
    saveOverlays()
  }

  /**
   * Add highlight overlay
   */
  function addHighlight(options?: Record<string, unknown>) {
    if (!layer || !transformer)
      return

    const highlight = new Konva.Rect({
      x: 100,
      y: 100,
      width: 200,
      height: 30,
      fill: 'rgba(255, 255, 0, 0.3)',
      draggable: true,
      name: 'overlay-object',
      ...options,
    })

    // Select on click
    highlight.on('click tap', () => {
      transformer!.nodes([highlight])
    })

    layer.add(highlight)
    transformer.nodes([highlight])
    layer.draw()
    saveOverlays()
  }

  /**
   * Get selected text node (if any)
   */
  function getSelectedTextNode(): Konva.Text | null {
    if (!transformer) return null
    const nodes = transformer.nodes()
    if (nodes.length === 1 && nodes[0] instanceof Konva.Text) {
      return nodes[0] as Konva.Text
    }
    return null
  }

  /**
   * Update text formatting properties
   */
  function updateTextFormatting(properties: {
    fontStyle?: string
    textDecoration?: string
    fontFamily?: string
    align?: string
    fontSize?: number
  }) {
    const textNode = getSelectedTextNode()
    if (!textNode) return

    if (properties.fontStyle !== undefined) textNode.fontStyle(properties.fontStyle)
    if (properties.textDecoration !== undefined) textNode.textDecoration(properties.textDecoration)
    if (properties.fontFamily !== undefined) {
      textNode.fontFamily(properties.fontFamily)
      if (activeTextarea) activeTextarea.style.fontFamily = properties.fontFamily
    }
    if (properties.align !== undefined) {
      textNode.align(properties.align)
      if (activeTextarea) activeTextarea.style.textAlign = properties.align
    }
    if (properties.fontSize !== undefined) {
      textNode.fontSize(properties.fontSize)
      if (activeTextarea) {
        activeTextarea.style.fontSize = `${properties.fontSize}px`
        activeTextarea.style.minHeight = `${properties.fontSize * 1.3}px`
      }
    }

    layer?.draw()
    syncFormattingState(textNode)
    saveOverlays()
  }

  /**
   * Update text color
   */
  function updateTextColor(color: string) {
    const textNode = getSelectedTextNode()
    if (!textNode) {
      console.warn('⚠️ No text node selected')
      return
    }

    textNode.fill(color)
    if (activeTextarea) activeTextarea.style.color = color
    layer?.draw()
    syncFormattingState(textNode)
    saveOverlays()
  }

  /**
   * Toggle text style (bold/italic)
   */
  function toggleTextStyle(style: 'bold' | 'italic') {
    const textNode = getSelectedTextNode()
    if (!textNode) return

    const currentStyle = textNode.fontStyle() || ''
    const styles = currentStyle.split(' ').filter(s => s)
    const hasStyle = styles.includes(style)
    if (hasStyle) textNode.fontStyle(styles.filter(s => s !== style).join(' '))
    else textNode.fontStyle([...styles, style].join(' '))

    // Mirror on active textarea for WYSIWYG feel
    if (activeTextarea) {
      const fs = textNode.fontStyle() || ''
      activeTextarea.style.fontWeight = fs.includes('bold') ? 'bold' : 'normal'
      activeTextarea.style.fontStyle = fs.includes('italic') ? 'italic' : 'normal'
    }

    layer?.draw()
    syncFormattingState(textNode)
    saveOverlays()
  }

  /**
   * Toggle text decoration (underline/line-through)
   */
  function toggleTextDecoration(decoration: 'underline' | 'line-through') {
    const textNode = getSelectedTextNode()
    if (!textNode) return

    const currentDeco = textNode.textDecoration() || ''
    const decos = currentDeco.split(' ').filter(d => d)
    const hasDeco = decos.includes(decoration)
    if (hasDeco) textNode.textDecoration(decos.filter(d => d !== decoration).join(' '))
    else textNode.textDecoration([...decos, decoration].join(' '))

    if (activeTextarea) activeTextarea.style.textDecoration = textNode.textDecoration() || 'none'

    layer?.batchDraw()
    syncFormattingState(textNode)
    saveOverlays()
  }

  /**
   * Get current text formatting state
   */
  function getTextFormattingState() {
    const textNode = getSelectedTextNode()
    if (!textNode) return null

    const fontStyle = textNode.fontStyle() || ''
    const textDecoration = textNode.textDecoration() || ''
    const fillColor = textNode.fill()

    const state = {
      isBold: fontStyle.includes('bold'),
      isItalic: fontStyle.includes('italic'),
      isUnderline: textDecoration.includes('underline'),
      isStrikethrough: textDecoration.includes('line-through'),
      fontFamily: textNode.fontFamily(),
      align: textNode.align(),
      fontSize: textNode.fontSize(),
      color: fillColor,
    }

    return state
  }

  /**
   * Show a blue glow on every overlay object so users know what is selectable.
   * Clears automatically on the next canvas click (via stage event handler).
   */
  function setSelectMode(active: boolean) {
    if (!layer) return
    selectModeActive = active
    ;(layer.find('.overlay-object') as Konva.Shape[]).forEach((obj) => {
      if (active) {
        obj.shadowColor('#7e22ce')
        obj.shadowBlur(5)
        obj.shadowOpacity(1)
        obj.shadowOffset({ x: 0, y: 0 })
        obj.shadowEnabled(true)
      }
      else {
        obj.shadowEnabled(false)
      }
    })
    layer.draw()
  }

  function clearSelectHighlights() {
    selectModeActive = false
    if (!layer) return
    ;(layer.find('.overlay-object') as Konva.Shape[]).forEach(obj => obj.shadowEnabled(false))
    layer.draw()
  }

  /**
   * Update stroke/fill properties on the currently selected shape
   */
  function updateShapeFormatting(props: { strokeWidth?: number, strokeColor?: string, fillColor?: string }) {
    if (!transformer) return
    const nodes = transformer.nodes()
    if (nodes.length === 0) return
    const node = nodes[0] as Konva.Shape
    if (!(node instanceof Konva.Rect) && !(node instanceof Konva.Ellipse) && !(node instanceof Konva.Line)) return

    if (props.strokeWidth !== undefined) node.strokeWidth(props.strokeWidth)
    if (props.strokeColor !== undefined) node.stroke(props.strokeColor)
    if (props.fillColor !== undefined) {
      node.fill(props.fillColor === 'transparent' ? '' : props.fillColor)
    }

    layer?.draw()
    syncShapeFormattingState(node)
    saveOverlays()
  }

  /**
   * Set the background colour of the current page.
   * Stores it as a special 'background' overlay so it is exported and applied in the PDF.
   */
  function setPageBackground(color: string) {
    currentPageBackgroundState.value = color

    // Apply visually to the Konva container
    if (stage) {
      const baseW = stage.width() / (stage.scaleX() || 1)
      const baseH = stage.height() / (stage.scaleY() || 1)
      _applyBackgroundRect(color, baseW, baseH)
    }

    // Persist as a background overlay object for this page
    state.objects = [
      ...state.objects.filter(o => !(o.page === state.currentPage && o.type === 'background')),
      {
        id: `bg-${state.currentPage}`,
        page: state.currentPage,
        type: 'background' as OverlayObject['type'],
        x: 0,
        y: 0,
        data: { color },
      },
    ]
  }

  function _applyBackgroundRect(color: string, baseW: number, baseH: number) {
    if (!layer) return
    // Remove existing background rect
    layer.find('.page-background').forEach(n => n.destroy())
    if (color && color !== 'transparent') {
      const bgRect = new Konva.Rect({
        x: 0,
        y: 0,
        width: baseW,
        height: baseH,
        fill: color,
        listening: false,
        name: 'page-background',
      })
      layer.add(bgRect)
      bgRect.moveToBottom()
      transformer?.moveToTop()
    }
    layer.draw()
  }

  /**
   * Delete selected object
   */
  function deleteSelected() {
    if (!transformer)
      return

    const nodes = transformer.nodes()
    if (nodes.length > 0) {
      nodes.forEach(node => node.destroy())
      transformer.nodes([])
      layer?.draw()
      saveOverlays()
      console.log('🗑️ Deleted selected object')
    }
  }

  /**
   * Clear all objects from canvas
   */
  function clearCanvas() {
    if (!layer)
      return

    // Remove all Konva nodes from the canvas (visual only — state.objects is managed by saveOverlays)
    const objects = layer.find('.overlay-object')
    objects.forEach(obj => obj.destroy())
    transformer?.nodes([])
    layer.draw()
    console.log('🧹 Canvas cleared')
  }

  /**
   * Save current canvas state — merges objects for the current page into the
   * global objects array, leaving other pages' objects untouched.
   * Background overlays are always preserved since they live outside the canvas scan.
   */
  function saveOverlays() {
    if (!layer || _loadingOverlays)
      return

    const objects = layer.find('.overlay-object')
    const currentPageObjects = objects.map((obj, index) => convertKonvaToOverlay(obj, index))

    // Keep other pages' objects + this page's background overlays, then add scanned canvas objects
    const otherPageObjects = state.objects.filter(o => o.page !== state.currentPage)
    const currentPageBackgrounds = state.objects.filter(o => o.page === state.currentPage && o.type === 'background')
    state.objects = [...otherPageObjects, ...currentPageBackgrounds, ...currentPageObjects]
    console.log('💾 Overlays saved:', state.objects.length, 'objects total,', currentPageObjects.length, 'on page', state.currentPage)
  }

  /**
   * Convert Konva node to overlay format
   */
  function convertKonvaToOverlay(node: Konva.Node, index: number): OverlayObject {
    const baseOverlay: OverlayObject = {
      id: node.id() || `obj-${index}-${Date.now()}`,
      page: state.currentPage,
      type: 'shape',
      x: node.x(),
      y: node.y(),
      width: node.width() * node.scaleX(),
      height: node.height() * node.scaleY(),
      rotation: node.rotation(),
      data: {},
    }

    if (node instanceof Konva.Text) {
      baseOverlay.type = 'text'
      baseOverlay.data = {
        text: node.text(),
        fontSize: node.fontSize(),
        color: node.fill(),
        fontFamily: node.fontFamily(),
        fontStyle: node.fontStyle() || '',
        textDecoration: node.textDecoration() || '',
        align: node.align() || 'left',
      }
    }
    else if (node instanceof Konva.Image) {
      baseOverlay.type = 'image'
      baseOverlay.data = {
        src: (node.image() as HTMLImageElement)?.src || '',
        opacity: node.opacity(),
      }
    }
    else if (node instanceof Konva.Rect) {
      const fill = node.fill()
      if (fill && typeof fill === 'string' && fill.includes('rgba')) {
        baseOverlay.type = 'highlight'
        baseOverlay.data = {
          color: fill,
          opacity: node.opacity(),
        }
      }
      else {
        baseOverlay.type = 'shape'
        baseOverlay.data = {
          shapeType: 'rectangle',
          fill: fill as string,
          stroke: node.stroke(),
          strokeWidth: node.strokeWidth(),
        }
      }
    }
    else if (node instanceof Konva.Ellipse) {
      baseOverlay.type = 'shape'
      baseOverlay.data = {
        shapeType: 'circle',
        fill: node.fill(),
        stroke: node.stroke(),
        strokeWidth: node.strokeWidth(),
      }
    }
    else if (node instanceof Konva.Line) {
      const isClosed = (node as Konva.Line).closed()
      baseOverlay.type = 'shape'
      baseOverlay.data = {
        shapeType: isClosed ? 'triangle' : 'line',
        points: [...(node as Konva.Line).points()],
        fill: isClosed ? ((node as Konva.Line).fill() as string) : undefined,
        stroke: node.stroke() as string,
        strokeWidth: node.strokeWidth(),
      }
    }

    return baseOverlay
  }

  /**
   * Load overlays for current page
   */
  async function loadOverlaysForPage(pageNumber: number, overlays: OverlayObject[]) {
    if (!layer)
      return

    clearCanvas()
    state.currentPage = pageNumber

    const pageOverlays = overlays.filter(o => o.page === pageNumber)

    // Apply stored page background (or reset to transparent)
    const bgOverlay = pageOverlays.find(o => o.type === 'background')
    const bgColor = (bgOverlay?.data?.color as string) || 'transparent'
    currentPageBackgroundState.value = bgColor === 'transparent' ? '#ffffff' : bgColor
    if (stage) {
      const baseW = stage.width() / (stage.scaleX() || 1)
      const baseH = stage.height() / (stage.scaleY() || 1)
      _applyBackgroundRect(bgColor, baseW, baseH)
    }

    // Suppress intermediate saveOverlays() calls from individual add* functions
    // so a late-resolving image doesn't clobber already-saved text/shapes.
    _loadingOverlays = true

    // Use for...of so we can properly await async addImage calls
    for (const overlay of pageOverlays) {
      if (overlay.type === 'text' && overlay.data.text) {
        addText(overlay.data.text, {
          x: overlay.x,
          y: overlay.y,
          fontSize: overlay.data.fontSize,
          fill: overlay.data.color,
          fontFamily: overlay.data.fontFamily,
          fontStyle: overlay.data.fontStyle,
          textDecoration: overlay.data.textDecoration,
          align: overlay.data.align,
          rotation: overlay.rotation,
        })
      }
      else if (overlay.type === 'image' && overlay.data.src) {
        // Await so the canvas has the image node before saveOverlays() fires
        await addImage(overlay.data.src, {
          x: overlay.x,
          y: overlay.y,
          rotation: overlay.rotation,
          opacity: overlay.data.opacity,
        })
      }
      else if (overlay.type === 'shape' && overlay.data.shapeType === 'rectangle') {
        addRectangle({
          x: overlay.x,
          y: overlay.y,
          width: overlay.width,
          height: overlay.height,
          fill: overlay.data.fill,
          stroke: overlay.data.stroke,
          strokeWidth: overlay.data.strokeWidth,
          rotation: overlay.rotation,
        })
      }
      else if (overlay.type === 'shape' && overlay.data.shapeType === 'circle') {
        addCircle({
          x: overlay.x,
          y: overlay.y,
          radiusX: (overlay.width || 100) / 2,
          radiusY: (overlay.height || 100) / 2,
          fill: overlay.data.fill,
          stroke: overlay.data.stroke,
          strokeWidth: overlay.data.strokeWidth,
          rotation: overlay.rotation,
        })
      }
      else if (overlay.type === 'shape' && overlay.data.shapeType === 'line') {
        addLine({
          x: overlay.x,
          y: overlay.y,
          points: overlay.data.points || [0, 0, 200, 0],
          stroke: overlay.data.stroke,
          strokeWidth: overlay.data.strokeWidth,
          rotation: overlay.rotation,
        })
      }
      else if (overlay.type === 'shape' && overlay.data.shapeType === 'triangle') {
        addTriangle({
          x: overlay.x,
          y: overlay.y,
          points: overlay.data.points || [50, 0, 100, 86, 0, 86],
          fill: overlay.data.fill,
          stroke: overlay.data.stroke,
          strokeWidth: overlay.data.strokeWidth,
          rotation: overlay.rotation,
        })
      }
      else if (overlay.type === 'highlight') {
        addHighlight({
          x: overlay.x,
          y: overlay.y,
          width: overlay.width,
          height: overlay.height,
          fill: overlay.data.color,
          rotation: overlay.rotation,
        })
      }
      else if (overlay.type === 'background') {
        // Already applied as a Konva rect above; nothing more to do here
      }
    }

    // Re-enable saving and do a single authoritative save now that every
    // element (including async images) is on the canvas.
    _loadingOverlays = false
    saveOverlays()

    console.log('📂 Loaded', pageOverlays.length, 'overlays for page', pageNumber)
  }

  /**
   * Switch to a different page: save the current page then load the target page.
   * pageNumber is 0-indexed (PDF page 1 = overlay page 0).
   */
  async function switchPage(pageNumber: number) {
    saveOverlays()
    await loadOverlaysForPage(pageNumber, state.objects)
  }

  /**
   * Remove all overlays for a given page and re-index pages that came after it.
   * Call this BEFORE reloading the PDF after a page deletion.
   * pageIndex is 0-indexed.
   */
  function deletePageOverlays(pageIndex: number) {
    saveOverlays()

    // Remove this page's overlays and re-index subsequent pages
    state.objects = state.objects
      .filter(o => o.page !== pageIndex)
      .map(o => o.page > pageIndex ? { ...o, page: o.page - 1 } : o)

    // Clear the Konva canvas so the deleted elements are not visible.
    if (layer) {
      layer.find('.overlay-object').forEach(obj => obj.destroy())
      transformer?.nodes([])
      selectedShapeFormattingState.value = null
      syncFormattingState(null)
      layer.draw()
    }

    // Reset to a sentinel so the next saveOverlays() call (triggered by the
    // page-change watcher after pdf.loadPDF) does not match any real page and
    // cannot overwrite the freshly re-indexed state.objects data.
    state.currentPage = -1
  }

  /**
   * Get all overlays as JSON
   */
  function getOverlaysJSON(): string {
    saveOverlays() // Sync canvas state before serializing
    return JSON.stringify(state.objects, null, 2)
  }

  /**
   * Dispose stage
   */
  function dispose() {
    // Remove keyboard listener
    if (keyboardHandler) {
      window.removeEventListener('keydown', keyboardHandler)
      keyboardHandler = null
    }

    // Remove outside-click listener
    if (outsideClickHandler) {
      document.removeEventListener('mousedown', outsideClickHandler)
      outsideClickHandler = null
    }

    // Remove active textarea if any
    if (activeTextarea) {
      activeTextarea.parentNode?.removeChild(activeTextarea)
      activeTextarea = null
    }

    if (stage) {
      stage.destroy()
      stage = null
    }
    layer = null
    transformer = null
    stageRef.value = null
    selectedFormatting.value = null
  }

  return {
    state: readonly(state),
    stage: readonly(stageRef),
    selectedFormatting: readonly(selectedFormatting),
    initCanvas,
    addText,
    addImage,
    addRectangle,
    addCircle,
    addHighlight,
    deleteSelected,
    clearCanvas,
    saveOverlays,
    loadOverlaysForPage,
    getOverlaysJSON,
    getSelectedTextNode,
    getTextFormattingState,
    toggleTextStyle,
    toggleTextDecoration,
    updateTextFormatting,
    updateTextColor,
    updateShapeFormatting,
    addLine,
    addTriangle,
    setSelectMode,
    setPageBackground,
    switchPage,
    deletePageOverlays,
    dispose,
  }
}
