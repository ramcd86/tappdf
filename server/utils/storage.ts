/**
 * Storage utility for handling file uploads and downloads
 * Supports both Vercel Blob (production) and local filesystem (development)
 */

import { promises as fs } from 'fs'
import path from 'path'
import { del, get, head, list, put } from '@vercel/blob'
import { nanoid } from 'nanoid'

const IS_LOCAL = process.env.NODE_ENV === 'development' && !process.env.BLOB_READ_WRITE_TOKEN
const LOCAL_STORAGE_DIR = path.join(process.cwd(), '.storage')

function normalizePathname(pathname: string): string {
  if (pathname.startsWith('/api/storage/')) {
    return pathname.replace(/^\/api\/storage\//, '')
  }

  try {
    const url = new URL(pathname)
    return url.pathname.replace(/^\/+/, '')
  }
  catch {
    return pathname.replace(/^\/+/, '')
  }
}

function toAppStorageUrl(pathname: string): string {
  return `/api/storage/${normalizePathname(pathname)}`
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }

  return Buffer.concat(chunks)
}

/**
 * Initialize local storage directory if in local mode
 */
async function initLocalStorage() {
  if (IS_LOCAL) {
    try {
      await fs.mkdir(LOCAL_STORAGE_DIR, { recursive: true })
      console.log('📁 Local storage initialized at:', LOCAL_STORAGE_DIR)
    }
    catch (error) {
      console.error('Failed to create local storage directory:', error)
    }
  }
}

// Initialize on module load
initLocalStorage()

export interface UploadResult {
  url: string
  pathname: string
  contentType: string
  size: number
}

export interface FileMetadata {
  url: string
  pathname: string
  size: number
  uploadedAt: Date
}

/**
 * Upload a file to storage (Vercel Blob or local filesystem)
 */
export async function uploadFile(
  file: Buffer | Blob,
  filename?: string,
  options?: { contentType?: string },
): Promise<UploadResult> {
  const uniqueFilename = filename || `${nanoid()}.pdf`
  const pathname = normalizePathname(uniqueFilename)
  
  if (IS_LOCAL) {
    // Local filesystem mock
    const filepath = path.join(LOCAL_STORAGE_DIR, pathname)
    
    let buffer: Buffer
    if (file instanceof Buffer) {
      buffer = file
    }
    else {
      const arrayBuffer = await (file as Blob).arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
    }
    
    await fs.writeFile(filepath, buffer)
    
    return {
      url: toAppStorageUrl(pathname),
      pathname,
      contentType: options?.contentType || 'application/pdf',
      size: buffer.length,
    }
  }
 
  else {
    // Vercel Blob
    let buffer: Buffer
    if (file instanceof Buffer) {
      buffer = file
    }
    else {
      const arrayBuffer = await (file as Blob).arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
    }

    const blob = await put(pathname, buffer, {
      access: 'private',
      allowOverwrite: true,
      contentType: options?.contentType || 'application/pdf',
    })
    
    return {
      url: toAppStorageUrl(blob.pathname),
      pathname: blob.pathname,
      contentType: blob.contentType || options?.contentType || 'application/pdf',
      size: buffer.length,
    }
  }
}

/**
 * Delete a file from storage
 */
export async function deleteFile(pathname: string): Promise<void> {
  const normalizedPathname = normalizePathname(pathname)

  if (IS_LOCAL) {
    const filepath = path.join(LOCAL_STORAGE_DIR, normalizedPathname)
    try {
      await fs.unlink(filepath)
    }
    catch (error) {
      console.error('Failed to delete local file:', error)
    }
  }
  else {
    await del(normalizedPathname)
  }
}

/**
 * Get file from storage
 */
export async function getFile(pathname: string): Promise<Buffer> {
  const normalizedPathname = normalizePathname(pathname)

  if (IS_LOCAL) {
    const filepath = path.join(LOCAL_STORAGE_DIR, normalizedPathname)
    return await fs.readFile(filepath)
  }
  else {
    const result = await get(normalizedPathname, { access: 'private' })
    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new Error(`Failed to fetch file: ${normalizedPathname}`)
    }

    return streamToBuffer(result.stream)
  }
}

/**
 * Check if file exists
 */
export async function fileExists(pathname: string): Promise<boolean> {
  const normalizedPathname = normalizePathname(pathname)

  if (IS_LOCAL) {
    const filepath = path.join(LOCAL_STORAGE_DIR, normalizedPathname)
    try {
      await fs.access(filepath)
      return true
    }
    catch {
      return false
    }
  }
  else {
    try {
      await head(normalizedPathname)
      return true
    }
    catch {
      return false
    }
  }
}

/**
 * List all files in storage
 */
export async function listFiles(): Promise<FileMetadata[]> {
  if (IS_LOCAL) {
    try {
      const files = await fs.readdir(LOCAL_STORAGE_DIR)
      const metadata: FileMetadata[] = []
      
      for (const file of files) {
        const filepath = path.join(LOCAL_STORAGE_DIR, file)
        const stats = await fs.stat(filepath)
        metadata.push({
          url: toAppStorageUrl(file),
          pathname: file,
          size: stats.size,
          uploadedAt: stats.birthtime,
        })
      }
      
      return metadata
    }
    catch {
      return []
    }
  }
  else {
    const { blobs } = await list()
    return blobs.map(blob => ({
      url: toAppStorageUrl(blob.pathname),
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
    }))
  }
}

/**
 * Generate a signed download URL (for local mode, just return the path)
 */
export async function getDownloadUrl(pathname: string, _expiresIn: number = 3600): Promise<string> {
  return toAppStorageUrl(pathname)
}

export { IS_LOCAL, LOCAL_STORAGE_DIR, normalizePathname, toAppStorageUrl }
