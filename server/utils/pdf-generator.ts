/**
 * PDF generation utility using pdf-lib
 * Applies overlay objects to an existing PDF
 */

import { PDFDocument, rgb, StandardFonts, PDFPage, degrees } from 'pdf-lib'
import type { OverlayObject, TextOverlay, ImageOverlay } from '~/types/overlay'

/**
 * Generate a PDF with overlays applied
 */
export async function generatePDFWithOverlays(
  originalPdfBuffer: Buffer,
  overlays: OverlayObject[]
): Promise<Buffer> {
  // Load the original PDF
  const pdfDoc = await PDFDocument.load(originalPdfBuffer)
  const pages = pdfDoc.getPages()
  
  // Group overlays by page
  const overlaysByPage = groupOverlaysByPage(overlays)
  
  // Apply overlays to each page
  for (const [pageIndex, pageOverlays] of Object.entries(overlaysByPage)) {
    const pageNum = parseInt(pageIndex)
    if (pageNum >= 0 && pageNum < pages.length) {
      const page = pages[pageNum]
      await applyOverlaysToPage(pdfDoc, page, pageOverlays)
    }
  }
  
  // Serialize the PDF to bytes
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

/**
 * Group overlays by page number
 */
function groupOverlaysByPage(overlays: OverlayObject[]): Record<number, OverlayObject[]> {
  const grouped: Record<number, OverlayObject[]> = {}
  
  for (const overlay of overlays) {
    const page = overlay.page || 0
    if (!grouped[page]) {
      grouped[page] = []
    }
    grouped[page].push(overlay)
  }
  
  return grouped
}

/**
 * Apply overlays to a specific PDF page
 */
async function applyOverlaysToPage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  overlays: OverlayObject[]
): Promise<void> {
  const { width: pageWidth, height: pageHeight } = page.getSize()

  // Background overlays must render first (below everything else)
  const sortedOverlays = [...overlays].sort((a, b) => {
    if (a.type === 'background') return -1
    if (b.type === 'background') return 1
    const zIndexA = (a.data as any).zIndex || 0
    const zIndexB = (b.data as any).zIndex || 0
    return zIndexA - zIndexB
  })

  for (const overlay of sortedOverlays) {
    try {
      switch (overlay.type) {
        case 'background':
          applyBackgroundOverlay(page, overlay, pageWidth, pageHeight)
          break
        case 'text':
          await applyTextOverlay(pdfDoc, page, overlay as TextOverlay, pageHeight)
          break
        case 'image':
          await applyImageOverlay(pdfDoc, page, overlay as ImageOverlay, pageHeight)
          break
        case 'highlight':
          await applyHighlightOverlay(page, overlay, pageHeight)
          break
        case 'shape':
          await applyShapeOverlay(page, overlay, pageHeight)
          break
        case 'drawing':
          console.warn('Drawing overlays not yet implemented')
          break
      }
    } catch (error) {
      console.error(`Failed to apply overlay ${overlay.id}:`, error)
    }
  }
}

/**
 * Split text into wrapped lines matching pdf-lib's maxWidth word-wrap behaviour.
 * Used to position underline/strikethrough decorations per line.
 */
function getWrappedLines(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = (text || '').split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(test, fontSize) <= maxWidth || !current) {
      current = test
    }
    else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : [text || '']
}

/**
 * Apply text overlay to page
 */
async function applyTextOverlay(
  pdfDoc: PDFDocument,
  page: PDFPage,
  overlay: TextOverlay,
  pageHeight: number
): Promise<void> {
  const { x, y, rotation = 0, data } = overlay
  const { text, fontSize, color, fontStyle = '', textDecoration = '', align = 'left' } = data

  // Choose font based on style
  let fontName = StandardFonts.Helvetica
  const isBold = fontStyle.includes('bold')
  const isItalic = fontStyle.includes('italic')
  if (isBold && isItalic) fontName = StandardFonts.HelveticaBoldOblique
  else if (isBold) fontName = StandardFonts.HelveticaBold
  else if (isItalic) fontName = StandardFonts.HelveticaOblique

  const font = await pdfDoc.embedFont(fontName)

  const rgbColor = hexToRgb(color || '#000000')
  const textColor = rgb(rgbColor.r, rgbColor.g, rgbColor.b)
  const size = fontSize || 16
  const lineHeight = size * 1.25
  const textWidth = overlay.width || 200
  const lineThickness = Math.max(0.5, size / 18)

  const needsUnderline = textDecoration.includes('underline')
  const needsStrikethrough = textDecoration.includes('line-through')

  // Convert a point from Konva's local text-box space to PDF page coordinates.
  //
  // Konva rotates around the node origin (top-left of text box) using CW-positive
  // rotation in a y-down coordinate system.  PDF has y-up, so y is flipped.
  //
  // localX = horizontal distance from the left edge of the text box (text direction)
  // localY = vertical distance from the TOP of the text box (downward, y-down)
  //
  // Konva CW rotation matrix (y-down): [[cosθ, -sinθ], [sinθ, cosθ]]
  // After flipping y for PDF:  pdf_y = pageHeight - konva_y
  const θ = rotation * Math.PI / 180
  const cosθ = Math.cos(θ)
  const sinθ = Math.sin(θ)

  function toPDF(localX: number, localY: number): { x: number; y: number } {
    return {
      x: x + localX * cosθ - localY * sinθ,
      y: pageHeight - y - localX * sinθ - localY * cosθ,
    }
  }

  // Konva's alphabetic baseline is at 0.85 × fontSize below the text-box top
  // (derived from Konva's fontBoundingBoxAscent/Descent metrics: (0.91f−0.21f)/2 + 0.5f).
  // Each subsequent line is offset by lineHeight in the local (rotated) frame.
  const lines = getWrappedLines(text || '', font, size, textWidth)

  lines.forEach((line, i) => {
    const lineWidth = font.widthOfTextAtSize(line, size)

    // Horizontal offset from text-box left edge (alignment)
    let hOff = 0
    if (align === 'center') hOff = (textWidth - lineWidth) / 2
    else if (align === 'right') hOff = textWidth - lineWidth

    // Vertical offset: baseline of line i from the text-box top
    const vOff = size * 0.85 + i * lineHeight

    const pos = toPDF(hOff, vOff)
    page.drawText(line, {
      x: pos.x,
      y: pos.y,
      size,
      font,
      color: textColor,
      rotate: degrees(-rotation),
    })

    if (needsUnderline) {
      page.drawLine({
        start: toPDF(hOff, vOff + lineThickness),
        end: toPDF(hOff + lineWidth, vOff + lineThickness),
        thickness: lineThickness,
        color: textColor,
      })
    }

    if (needsStrikethrough) {
      const strikeLY = vOff - size * 0.28
      page.drawLine({
        start: toPDF(hOff, strikeLY),
        end: toPDF(hOff + lineWidth, strikeLY),
        thickness: lineThickness,
        color: textColor,
      })
    }
  })
}

/**
 * Apply image overlay to page
 */
async function applyImageOverlay(
  pdfDoc: PDFDocument,
  page: PDFPage,
  overlay: ImageOverlay,
  pageHeight: number
): Promise<void> {
  const { x, y, width = 100, height = 100, rotation = 0, data } = overlay
  const { src, opacity = 1 } = data

  try {
    let imageBytes: ArrayBuffer

    if (src.startsWith('data:')) {
      const base64Data = src.split(',')[1]
      imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)).buffer
    }
    else {
      const response = await fetch(src)
      imageBytes = await response.arrayBuffer()
    }

    // Detect format: check MIME type in data URL first, then fall back to file extension
    let image
    const mime = src.startsWith('data:') ? src.split(';')[0].split(':')[1] : ''
    const isPng = mime === 'image/png' || src.endsWith('.png')
    if (isPng) {
      image = await pdfDoc.embedPng(imageBytes)
    }
    else {
      // Try JPG first; if it fails try PNG (some images may be mislabelled)
      try {
        image = await pdfDoc.embedJpg(imageBytes)
      }
      catch {
        image = await pdfDoc.embedPng(imageBytes)
      }
    }

    // PDF origin is bottom-left; Konva origin is top-left
    const pdfY = pageHeight - y - height

    console.log(`🖼  Image PDF coords: x=${x.toFixed(1)}, y_canvas=${y.toFixed(1)}, pdfY=${pdfY.toFixed(1)}, w=${width.toFixed(1)}, h=${height.toFixed(1)}`)

    page.drawImage(image, {
      x,
      y: pdfY,
      width,
      height,
      opacity,
      rotate: degrees(-rotation),
    })
  }
  catch (error) {
    console.error('Failed to embed image:', error)
  }
}

/**
 * Apply page background colour — drawn as a full-page rectangle before all other content.
 */
function applyBackgroundOverlay(
  page: PDFPage,
  overlay: OverlayObject,
  pageWidth: number,
  pageHeight: number,
): void {
  const color = (overlay.data.color as string) || '#ffffff'
  if (color === 'transparent') return
  const { r, g, b } = hexToRgb(color)
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: rgb(r, g, b),
  })
}

/**
 * Apply highlight overlay to page
 */
async function applyHighlightOverlay(
  page: PDFPage,
  overlay: OverlayObject,
  pageHeight: number
): Promise<void> {
  const { x, y, width = 100, height = 20, data } = overlay
  const color = data.color || '#FFFF00'
  const opacity = data.opacity || 0.3
  
  const rgbColor = hexToRgb(color)
  const pdfY = pageHeight - y - height
  
  page.drawRectangle({
    x,
    y: pdfY,
    width,
    height,
    color: rgb(rgbColor.r, rgbColor.g, rgbColor.b),
    opacity
  })
}

/**
 * Apply shape overlay to page
 */
async function applyShapeOverlay(
  page: PDFPage,
  overlay: OverlayObject,
  pageHeight: number
): Promise<void> {
  const { x, y, width = 100, height = 100, rotation = 0, data } = overlay
  const shapeType = data.shapeType || 'rectangle'

  // Field names match convertKonvaToOverlay: stroke, fill, strokeWidth
  const strokeHex: string = data.stroke || '#000000'
  const fillHex: string | undefined = data.fill
  const strokeWidth: number = data.strokeWidth ?? 2

  const strokeRgb = hexToRgb(strokeHex)
  const pdfY = pageHeight - y - height

  // Only apply fill colour if it's a real colour (not 'transparent' / 'none')
  let fillColor: ReturnType<typeof rgb> | undefined
  if (fillHex && fillHex !== 'transparent' && fillHex !== 'none' && fillHex !== '') {
    const f = hexToRgb(fillHex)
    fillColor = rgb(f.r, f.g, f.b)
  }

  if (shapeType === 'rectangle') {
    page.drawRectangle({
      x,
      y: pdfY,
      width,
      height,
      borderColor: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
      borderWidth: strokeWidth,
      color: fillColor,
      rotate: degrees(-rotation),
    })
  }
  else if (shapeType === 'circle') {
    // x and y from Konva.Circle are already the center coordinates,
    // so just flip the Y axis — do not add width/height offsets.
    page.drawEllipse({
      x,
      y: pageHeight - y,
      xScale: width / 2,
      yScale: height / 2,
      borderColor: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
      borderWidth: strokeWidth,
      color: fillColor,
      rotate: degrees(-rotation),
    })
  }
  else if (shapeType === 'line' || shapeType === 'triangle') {
    // Points are in Konva local coords; rotation is applied around (x, y).
    const points: number[] = data.points || (shapeType === 'line' ? [0, 0, 200, 0] : [50, 0, 100, 86, 0, 86])
    const rot = (rotation * Math.PI) / 180
    const cosR = Math.cos(rot)
    const sinR = Math.sin(rot)

    // Convert a local point to Konva world coords, then to PDF coords.
    // Konva world: (x + px*cosR - py*sinR,  y + px*sinR + py*cosR)
    // PDF coords:  world_x stays same, pdf_y = pageHeight - world_y
    const toWorld = (px: number, py: number) => ({
      wx: x + px * cosR - py * sinR,
      wy: y + px * sinR + py * cosR,
    })

    if (shapeType === 'line') {
      const s = toWorld(points[0], points[1])
      const e = toWorld(points[2], points[3])
      page.drawLine({
        start: { x: s.wx, y: pageHeight - s.wy },
        end: { x: e.wx, y: pageHeight - e.wy },
        thickness: strokeWidth,
        color: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
      })
    }
    else {
      // Triangle — use drawSvgPath with SVG origin at page top-left.
      // Setting x:0, y:pageHeight maps SVG coords (y down) to Konva canvas coords.
      const v1 = toWorld(points[0], points[1])
      const v2 = toWorld(points[2], points[3])
      const v3 = toWorld(points[4], points[5])
      const pathStr = `M ${v1.wx.toFixed(2)} ${v1.wy.toFixed(2)} L ${v2.wx.toFixed(2)} ${v2.wy.toFixed(2)} L ${v3.wx.toFixed(2)} ${v3.wy.toFixed(2)} Z`
      page.drawSvgPath(pathStr, {
        x: 0,
        y: pageHeight,
        color: fillColor,
        borderColor: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
        borderWidth: strokeWidth,
      })
    }
  }
}

/**
 * Convert hex color to RGB values (0-1 range)
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  if (!hex || hex === 'transparent' || hex === 'none' || !hex.startsWith('#')) {
    return { r: 0, g: 0, b: 0 }
  }
  hex = hex.replace(/^#/, '')
  // Expand shorthand #abc → #aabbcc
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
  
  // Parse hex values
  const bigint = parseInt(hex, 16)
  const r = ((bigint >> 16) & 255) / 255
  const g = ((bigint >> 8) & 255) / 255
  const b = (bigint & 255) / 255
  
  return { r, g, b }
}

/**
 * Validate overlay data
 */
export function validateOverlays(overlays: any[]): overlays is OverlayObject[] {
  if (!Array.isArray(overlays)) {
    return false
  }
  
  return overlays.every(overlay => {
    return (
      overlay &&
      typeof overlay === 'object' &&
      typeof overlay.id === 'string' &&
      typeof overlay.type === 'string' &&
      typeof overlay.x === 'number' &&
      typeof overlay.y === 'number' &&
      overlay.data &&
      typeof overlay.data === 'object'
    )
  })
}
