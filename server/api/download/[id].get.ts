/**
 * API endpoint to download generated PDF
 * GET /api/download/[id]
 */

import { getDocument } from '~/server/db/client'
import { getFile, getDownloadUrl } from '~/server/utils/storage'

export default defineEventHandler(async (event) => {
  try {
    const documentId = getRouterParam(event, 'id')
    
    if (!documentId) {
      throw createError({
        statusCode: 400,
        message: 'Document ID is required'
      })
    }

    // Get document from database
    const document = await getDocument(documentId)
    
    if (!document) {
      throw createError({
        statusCode: 404,
        message: 'Document not found'
      })
    }

    // Check if final PDF exists
    if (!document.final_path) {
      throw createError({
        statusCode: 404,
        message: 'PDF not yet generated'
      })
    }

    // Check payment status
    if (document.payment_status !== 'paid') {
      throw createError({
        statusCode: 402,
        message: 'Payment required'
      })
    }

    // Get download URL
    const downloadUrl = await getDownloadUrl(document.final_path)
    
    // Option 1: Redirect to signed URL
    // return sendRedirect(event, downloadUrl)
    
    // Option 2: Stream file directly (better for local development)
    const fileBuffer = await getFile(document.final_path)
    
    // Set headers for download
    const filename = `tappdf-${documentId}.pdf`
    setResponseHeader(event, 'Content-Type', 'application/pdf')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
    setResponseHeader(event, 'Content-Length', fileBuffer.length)
    
    return fileBuffer
  } catch (error: any) {
    console.error('Download error:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      message: 'Failed to download file'
    })
  }
})
