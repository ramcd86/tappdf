/**
 * API endpoint for file uploads
 * POST /api/upload
 */

import { uploadFile } from '~/server/utils/storage'
import { createDocument } from '~/server/db/client'

export default defineEventHandler(async (event) => {
  try {
    // Parse multipart form data
    const formData = await readMultipartFormData(event)

    if (!formData || formData.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'No file provided',
      })
    }

    // Get the uploaded file
    const file = formData.find(item => item.name === 'file')

    if (!file || !file.data) {
      throw createError({
        statusCode: 400,
        message: 'Invalid file upload',
      })
    }

    // Validate file type
    const contentType = file.type || ''
    if (!contentType.includes('pdf')) {
      throw createError({
        statusCode: 400,
        message: 'Only PDF files are allowed',
      })
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.data.length > maxSize) {
      throw createError({
        statusCode: 400,
        message: 'File size exceeds 10MB limit',
      })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const filename = `upload-${timestamp}.pdf`

    // Upload file to storage
    const uploadResult = await uploadFile(
      file.data,
      filename,
      { contentType: 'application/pdf' },
    )

    // Calculate expiry time (24 hours from now)
    const expiryHours = parseInt(process.env.FILE_EXPIRY_HOURS || '24')
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000)

    // Create document record in database
    const document = await createDocument({
      uploadPath: uploadResult.pathname,
      expiresAt,
    })

    // Return response
    return {
      success: true,
      documentId: document.id,
      uploadUrl: uploadResult.url,
      expiresAt: document.expires_at.toISOString(),
      size: uploadResult.size,
    }
  }
  catch (error: any) {
    console.error('Upload error:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Failed to upload file',
    })
  }
})
