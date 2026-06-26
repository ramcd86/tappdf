/**
 * Get document information by ID
 * GET /api/document/[id]
 */

import { getDocument } from '~/server/db/client'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  console.log('📄 Fetching document:', id)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Document ID is required',
    })
  }

  try {
    const document = await getDocument(id)

    console.log('📄 Document found:', document ? 'Yes' : 'No')

    if (!document) {
      throw createError({
        statusCode: 404,
        message: 'Document not found',
      })
    }

    // Return document info with file URL
    return {
      id: document.id,
      uploadUrl: document.upload_path,
      overlayUrl: document.overlay_path,
      finalUrl: document.final_path,
      paymentStatus: document.payment_status,
      createdAt: document.created_at,
      expiresAt: document.expires_at,
    }
  }
  catch (error: any) {
    console.error('Error fetching document:', error)
    
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Failed to fetch document',
    })
  }
})
