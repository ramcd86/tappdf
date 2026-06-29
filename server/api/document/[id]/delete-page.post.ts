/**
 * POST /api/document/:id/delete-page
 * Removes one page from the existing PDF document.
 * Body: { pageIndex: number }  — 0-based page index
 */

import { PDFDocument } from 'pdf-lib'
import { getDocument, updateDocumentUpload } from '~/server/db/client'
import { getFile, toAppStorageUrl, uploadFile } from '~/server/utils/storage'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Document ID is required' })
  }

  const body = await readBody<{ pageIndex: number }>(event)
  if (typeof body?.pageIndex !== 'number') {
    throw createError({ statusCode: 400, message: 'pageIndex is required' })
  }

  const document = await getDocument(id)
  if (!document) {
    throw createError({ statusCode: 404, message: 'Document not found' })
  }

  const pdfBuffer = await getFile(document.upload_path)
  const pdfDoc = await PDFDocument.load(pdfBuffer)

  if (pdfDoc.getPageCount() <= 1) {
    throw createError({ statusCode: 400, message: 'Cannot delete the only page' })
  }

  if (body.pageIndex < 0 || body.pageIndex >= pdfDoc.getPageCount()) {
    throw createError({ statusCode: 400, message: 'Invalid page index' })
  }

  pdfDoc.removePage(body.pageIndex)

  const newBytes = await pdfDoc.save()
  const filename = `document-${id}-${Date.now()}-pages-${pdfDoc.getPageCount()}.pdf`
  const uploadResult = await uploadFile(Buffer.from(newBytes), filename, { contentType: 'application/pdf' })
  await updateDocumentUpload(id, uploadResult.pathname)

  return {
    pageCount: pdfDoc.getPageCount(),
    uploadUrl: toAppStorageUrl(uploadResult.pathname),
  }
})
