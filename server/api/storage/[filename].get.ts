/**
 * Storage file serving endpoint.
 * Local dev reads from .storage; production streams private Vercel Blob files
 * through the app so browsers never need direct Blob access.
 */

import { fileExists, getFile, normalizePathname } from '~/server/utils/storage'

export default defineEventHandler(async (event) => {
  const filename = getRouterParam(event, 'filename')
  
  if (!filename) {
    throw createError({
      statusCode: 400,
      message: 'Filename required'
    })
  }

  // Security: prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw createError({
      statusCode: 400,
      message: 'Invalid filename'
    })
  }

  const pathname = normalizePathname(filename)

  try {
    if (!(await fileExists(pathname))) {
      throw createError({
        statusCode: 404,
        message: 'File not found'
      })
    }
    
    const fileBuffer = await getFile(pathname)
    const contentType = pathname.endsWith('.json')
      ? 'application/json'
      : pathname.endsWith('.png')
        ? 'image/png'
        : pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')
          ? 'image/jpeg'
          : 'application/pdf'
    
    setResponseHeader(event, 'Content-Type', contentType)
    setResponseHeader(event, 'Content-Disposition', `inline; filename="${filename}"`)
    
    return fileBuffer
  } catch (error: any) {
    if (error.statusCode) throw error

    throw createError({
      statusCode: 404,
      message: 'File not found'
    })
  }
})
