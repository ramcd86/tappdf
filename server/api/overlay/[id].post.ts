/**
 * API endpoint to save overlay data for a document
 * POST /api/overlay/:id
 */

import { getDocument, updateDocumentOverlay } from '~/server/db/client'
import { uploadFile } from '~/server/utils/storage'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Document ID is required' })
  }

  const body = await readBody(event)
  const overlays = body?.overlays ?? []

  const document = await getDocument(id)
  if (!document) {
    throw createError({ statusCode: 404, message: 'Document not found' })
  }

  const overlayJSON = JSON.stringify(overlays)
  const overlayBuffer = Buffer.from(overlayJSON, 'utf-8')
  const overlayFilename = `overlay-${id}.json`

  const result = await uploadFile(overlayBuffer, overlayFilename, {
    contentType: 'application/json',
  })

  await updateDocumentOverlay(id, result.pathname)

  return { success: true, count: overlays.length }
})
