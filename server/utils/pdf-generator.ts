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
  
  // Sort overlays by z-index if available
  const sortedOverlays = [...overlays].sort((a, b) => {
    const zIndexA = (a.data as any).zIndex || 0
    const zIndexB = (b.data as any).zIndex || 0
    return zIndexA - zIndexB
  })
  
  for (const overlay of sortedOverlays) {
    try {
      switch (overlay.type) {
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
          // Drawing overlays could be complex - implement if needed
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
  const { text, fontSize, color, fontStyle = '', textDecoration = '' } = data

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

  // PDF Y origin is bottom-left; Konva Y origin is top-left.
  const pdfY = pageHeight - y - size

  page.drawText(text || '', {
    x,
    y: pdfY,
    size,
    font,
    color: textColor,
    rotate: degrees(-rotation),
    maxWidth: textWidth,
    lineHeight,
  })

  // Underline and strikethrough must be drawn manually — pdf-lib has no textDecoration.
  const needsUnderline = textDecoration.includes('underline')
  const needsStrikethrough = textDecoration.includes('line-through')

  if (needsUnderline || needsStrikethrough) {
    const lines = getWrappedLines(text || '', font, size, textWidth)
    lines.forEach((line, i) => {
      const lineWidth = font.widthOfTextAtSize(line, size)
      const baselineY = pdfY - i * lineHeight

      if (needsUnderline) {
        page.drawLine({
          start: { x, y: baselineY - lineThickness },
          end: { x: x + lineWidth, y: baselineY - lineThickness },
          thickness: lineThickness,
          color: textColor,
        })
      }

      if (needsStrikethrough) {
        // Strike at ~40% of cap height above baseline
        const strikeY = baselineY + size * 0.28
        page.drawLine({
          start: { x, y: strikeY },
          end: { x: x + lineWidth, y: strikeY },
          thickness: lineThickness,
          color: textColor,
        })
      }
    })
  }
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
    page.drawEllipse({
      x: x + width / 2,
      y: pdfY + height / 2,
      xScale: width / 2,
      yScale: height / 2,
      borderColor: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
      borderWidth: strokeWidth,
      color: fillColor,
      rotate: degrees(-rotation),
    })
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
