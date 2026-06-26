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
  let clipGroup: Konva.Group | null = null   // content inside here is clipped to PDF page
  let transformer: Konva.Transformer | null = null
  let keyboardHandler: ((e: KeyboardEvent) => void) | null = null
  let activeTextarea: HTMLTextAreaElement | null = null

  // Refs for external access
  const stageRef = ref<Konva.Stage | null>(null)

  // Reactive formatting state — updated synchronously by Konva events (replaces polling)
  const selectedFormatting = selectedFormattingState

  function syncFormattingState(node: Konva.Text | null) {
    if (!node) { selectedFormatting.value = null; return }
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

    // Single layer for all content
    layer = new Konva.Layer()
    stage.add(layer)

    // Clipped group keeps overlay objects inside the PDF page boundary.
    // The transformer is added directly to layer (outside the group) so its
    // resize/rotate handles render even near the page edge.
    // Using individual clip properties (not compound clip()) for reliable hit detection.
    clipGroup = new Konva.Group({
      clipX: 0,
      clipY: 0,
      clipWidth: width,
      clipHeight: height,
    })
    layer.add(clipGroup)

    // Transformer for resize/rotate handles
    transformer = new Konva.Transformer({
      nodes: [],
      rotateEnabled: true,
      resizeEnabled: true,
      borderStroke: '#3b82f6',
      borderStrokeWidth: 2,
      anchorFill: '#3b82f6',
      anchorStroke: '#ffffff',
      anchorSize: 12,
      anchorCornerRadius: 6,
      keepRatio: false,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center'],
    })
    layer.add(transformer)

    // Click on empty area to deselect and clear toolbar
    stage.on('click tap', (e) => {
      if (e.target === stage) {
        transformer?.nodes([])
        syncFormattingState(null)
      }
    })

    // Transform events handled below

    // Save overlays when object is modified
    stage.on('dragend transformend', saveOverlays)

    // Handle text node transforms - prevent scaling, adjust container dimensions instead
    transformer.on('transformend', (e) => {
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

    return stage
  }

  /**
   * Add text overlay
   */
  function addText(text: string = 'New Text', options?: any) {
    if (!layer || !transformer || !clipGroup)
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

    // Select on click — also syncs toolbar state reactively
    textNode.on('click tap', () => {
      transformer!.nodes([textNode])
      layer!.draw()
      syncFormattingState(textNode)
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
      textarea.style.border = '1px solid rgba(59, 130, 246, 0.8)'
      textarea.style.outline = 'none'
      textarea.style.padding = '2px'
      textarea.style.margin = '0'
      textarea.style.overflow = 'hidden'
      textarea.style.resize = 'none'
      textarea.style.boxSizing = 'border-box'
      textarea.style.wordBreak = 'break-all'  // force wrapping of long words/URLs

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
        layer?.draw()  // guard: layer may be null if component unmounted
        textarea.parentNode?.removeChild(textarea)
        syncFormattingState(textNode)
        saveOverlays()
      }

      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); removeTextarea() }
        // Enter without shift commits; shift+Enter inserts newline
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); removeTextarea() }
      })

      // Delay blur-close by 200ms so toolbar clicks register first
      textarea.addEventListener('blur', () => setTimeout(removeTextarea, 200))
    })

    clipGroup.add(textNode)
    transformer.nodes([textNode])
    syncFormattingState(textNode)  // activate toolbar immediately on add
    layer.draw()
    saveOverlays()
  }

  /**
   * Add image overlay
   */
  async function addImage(imageUrl: string, options?: any) {
    if (!layer || !transformer || !clipGroup)
      return

    return new Promise<void>((resolve, reject) => {
      const imageObj = new Image()
      // crossOrigin only for HTTP URLs — setting it on data URLs blocks loading
      if (!imageUrl.startsWith('data:')) {
        imageObj.crossOrigin = 'anonymous'
      }

      imageObj.onload = () => {
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

        clipGroup!.add(image)
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
  function addRectangle(options?: any) {
    if (!layer || !transformer || !clipGroup)
      return

    const rect = new Konva.Rect({
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 2,
      draggable: true,
      name: 'overlay-object',
      ...options,
    })

    // Select on click
    rect.on('click tap', () => {
      transformer!.nodes([rect])
    })

    clipGroup.add(rect)
    transformer.nodes([rect])
    layer.draw()
    saveOverlays()
  }

  /**
   * Add circle shape
   */
  function addCircle(options?: any) {
    if (!layer || !transformer || !clipGroup)
      return

    const circle = new Konva.Circle({
      x: 150,
      y: 150,
      radius: 50,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 2,
      draggable: true,
      name: 'overlay-object',
      ...options,
    })

    // Select on click
    circle.on('click tap', () => {
      transformer!.nodes([circle])
    })

    clipGroup.add(circle)
    transformer.nodes([circle])
    layer.draw()
    saveOverlays()
  }

  /**
   * Add highlight overlay
   */
  function addHighlight(options?: any) {
    if (!layer || !transformer || !clipGroup)
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

    clipGroup.add(highlight)
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

    // Remove all objects except transformer
    const objects = layer.find('.overlay-object')
    objects.forEach(obj => obj.destroy())
    transformer?.nodes([])
    layer.draw()
    state.objects = []
    console.log('🧹 Canvas cleared')
  }

  /**
   * Save current canvas state to overlay objects
   */
  function saveOverlays() {
    if (!layer)
      return

    const objects = layer.find('.overlay-object')
    state.objects = objects.map((obj, index) => convertKonvaToOverlay(obj, index))
    console.log('💾 Overlays saved:', state.objects.length, 'objects')
  }

  /**
   * Convert Konva node to overlay format
   */
  function convertKonvaToOverlay(node: Konva.Node, index: number): OverlayObject {
    // getAbsolutePosition() gives stage-space coordinates regardless of group nesting.
    // node.x() / node.y() are local to the parent (clipGroup) which may differ if the
    // group has any transform applied.
    const absPos = node.getAbsolutePosition()

    const baseOverlay: OverlayObject = {
      id: node.id() || `obj-${index}-${Date.now()}`,
      page: state.currentPage,
      type: 'shape',
      x: absPos.x,
      y: absPos.y,
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
    else if (node instanceof Konva.Circle) {
      baseOverlay.type = 'shape'
      baseOverlay.data = {
        shapeType: 'circle',
        fill: node.fill(),
        stroke: node.stroke(),
        strokeWidth: node.strokeWidth(),
        radius: (node as Konva.Circle).radius() * node.scaleX(),
      }
    }

    return baseOverlay
  }

  /**
   * Load overlays for current page
   */
  function loadOverlaysForPage(pageNumber: number, overlays: OverlayObject[]) {
    if (!layer)
      return

    clearCanvas()
    state.currentPage = pageNumber

    const pageOverlays = overlays.filter(o => o.page === pageNumber)
    
    // Convert overlay objects back to Konva nodes
    pageOverlays.forEach((overlay) => {
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
        addImage(overlay.data.src, {
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
          x: overlay.x + (overlay.width || 0) / 2,
          y: overlay.y + (overlay.height || 0) / 2,
          radius: overlay.data.radius,
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
    })

    console.log('📂 Loaded', pageOverlays.length, 'overlays for page', pageNumber)
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
    clipGroup = null
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
    dispose,
  }
}
