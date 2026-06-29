/**
 * API endpoint to generate final PDF with overlays
 * POST /api/generate
 */

import { getDocument, updateDocumentFinal } from '~/server/db/client'
import { getFile, uploadFile } from '~/server/utils/storage'
import { generatePDFWithOverlays } from '~/server/utils/pdf-generator'
import { IS_STRIPE_MOCK } from '~/server/utils/stripe'
import type { OverlayObject } from '~/types/overlay'

interface GenerateRequest {
  documentId: string
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<GenerateRequest>(event)
    
    // Validate request
    if (!body.documentId) {
      throw createError({
        statusCode: 400,
        message: 'Document ID is required'
      })
    }

    // Get document from database
    const document = await getDocument(body.documentId)
    
    if (!document) {
      throw createError({
        statusCode: 404,
        message: 'Document not found'
      })
    }

    // Check if document has expired
    if (document.expires_at < new Date()) {
      throw createError({
        statusCode: 410,
        message: 'Document has expired'
      })
    }

    // Check payment status
    if (document.payment_status !== 'paid') {
      // For mock mode, we'll allow generation anyway
      if (!IS_STRIPE_MOCK) {
        throw createError({
          statusCode: 402,
          message: 'Payment required'
        })
      }
      console.log('⚠️  Generating PDF without payment verification (mock mode)')
    }

    // Get original PDF
    const originalPdfBuffer = await getFile(document.upload_path)

    // Get overlay data
    let overlays: OverlayObject[] = []
    
    if (document.overlay_path) {
      try {
        const overlayBuffer = await getFile(document.overlay_path)
        overlays = JSON.parse(overlayBuffer.toString('utf-8'))
      } catch (error) {
        console.error('Failed to load overlay data:', error)
        // Continue without overlays
      }
    }

    // Generate PDF with overlays
    console.log(`🔨 Generating PDF for document ${body.documentId} with ${overlays.length} overlays`)
    
    const finalPdfBuffer = await generatePDFWithOverlays(originalPdfBuffer, overlays)

    // Upload final PDF to storage
    const finalFilename = `final-${body.documentId}-${Date.now()}.pdf`
    const finalUpload = await uploadFile(
      finalPdfBuffer,
      finalFilename,
      { contentType: 'application/pdf' }
    )

    // Update document with final path
    await updateDocumentFinal(body.documentId, finalUpload.pathname, 'paid')

    // Calculate expiry time for download (1 hour)
    const downloadExpiresAt = new Date(Date.now() + 60 * 60 * 1000)

    console.log(`✅ PDF generated successfully: ${finalUpload.pathname}`)

    // Return response
    return {
      success: true,
      downloadUrl: finalUpload.url,
      documentId: body.documentId,
      expiresAt: downloadExpiresAt.toISOString()
    }
  } catch (error: any) {
    console.error('PDF generation error:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      message: 'Failed to generate PDF'
    })
  }
})
