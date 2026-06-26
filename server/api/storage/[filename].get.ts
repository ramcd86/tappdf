/**
 * Local storage file serving endpoint (for development only)
 * GET /api/storage/[filename]
 */

import { promises as fs } from 'fs'
import path from 'path'
import { IS_LOCAL, LOCAL_STORAGE_DIR } from '~/server/utils/storage'

export default defineEventHandler(async (event) => {
  if (!IS_LOCAL) {
    throw createError({
      statusCode: 404,
      message: 'This endpoint is only available in local development mode'
    })
  }

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

  const filepath = path.join(LOCAL_STORAGE_DIR, filename)

  try {
    // Check if file exists
    await fs.access(filepath)
    
    // Read file
    const fileBuffer = await fs.readFile(filepath)
    
    // Set appropriate headers
    setResponseHeader(event, 'Content-Type', 'application/pdf')
    setResponseHeader(event, 'Content-Disposition', `inline; filename="${filename}"`)
    
    return fileBuffer
  } catch (error) {
    throw createError({
      statusCode: 404,
      message: 'File not found'
    })
  }
})
