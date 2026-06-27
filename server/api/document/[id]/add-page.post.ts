/**
 * POST /api/document/:id/add-page
 * Appends a blank A4 page to the existing PDF document.
 */

import { PDFDocument } from 'pdf-lib'
import { getDocument } from '~/server/db/client'
import { getFile, uploadFile } from '~/server/utils/storage'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Document ID is required' })
  }

  const document = await getDocument(id)
  if (!document) {
    throw createError({ statusCode: 404, message: 'Document not found' })
  }

  // Load the current PDF
  const pdfBuffer = await getFile(document.upload_path)
  const pdfDoc = await PDFDocument.load(pdfBuffer)

  // Append a blank A4 page (595.28 × 841.89 pts)
  pdfDoc.addPage([595.28, 841.89])

  // Save back to the same file (overwrites existing)
  const newBytes = await pdfDoc.save()
  const filename = document.upload_path.replace(/^\/api\/storage\//, '')
  await uploadFile(Buffer.from(newBytes), filename, { contentType: 'application/pdf' })

  return { pageCount: pdfDoc.getPageCount() }
})
