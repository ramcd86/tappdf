/**
 * Create a blank PDF document
 * Generates a new blank A4 PDF and returns document ID
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { nanoid } from 'nanoid'
import { uploadFile } from '~/server/utils/storage'
import { createDocument } from '~/server/db/client'

export default defineEventHandler(async (event) => {
  try {
    // Get options from request body
    const body = await readBody(event)
    const {
      pages = 1,
      pageSize = 'A4',
    } = body || {}

    // Create blank PDF
    const pdfDoc = await PDFDocument.create()

    // A4 dimensions in points (595.28 x 841.89)
    const width = 595.28
    const height = 841.89

    // Add requested number of pages
    for (let i = 0; i < pages; i++) {
      pdfDoc.addPage([width, height])
    }

    // Serialize to bytes
    const pdfBytes = await pdfDoc.save()
    const buffer = Buffer.from(pdfBytes)

    // Generate filename
    const filename = `blank-${nanoid()}.pdf`

    // Upload to storage
    const { url } = await uploadFile(buffer, filename, { contentType: 'application/pdf' })

    // Create document record
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    const document = await createDocument({
      uploadPath: url,
      overlayPath: null,
      finalPath: null,
      paymentStatus: 'pending',
      expiresAt,
    })

    console.log(`📄 Created blank PDF with ${pages} page(s): ${document.id}`)

    return {
      documentId: document.id,
      uploadUrl: url,
      pages,
      expiresAt: document.expires_at.toISOString(),
    }
  }
  catch (error: any) {
    console.error('Error creating blank PDF:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to create blank PDF',
      data: { error },
    })
  }
})
