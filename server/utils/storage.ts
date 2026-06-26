/**
 * Storage utility for handling file uploads and downloads
 * Supports both Vercel Blob (production) and local filesystem (development)
 */

import { promises as fs } from 'fs'
import path from 'path'
import { del, head, list, put } from '@vercel/blob'
import { nanoid } from 'nanoid'

const IS_LOCAL = process.env.NODE_ENV === 'development' && !process.env.BLOB_READ_WRITE_TOKEN
const LOCAL_STORAGE_DIR = path.join(process.cwd(), '.storage')

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
  
  if (IS_LOCAL) {
    // Local filesystem mock
    const filepath = path.join(LOCAL_STORAGE_DIR, uniqueFilename)
    
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
      url: `/api/storage/${uniqueFilename}`,
      pathname: uniqueFilename,
      contentType: options?.contentType || 'application/pdf',
      size: buffer.length,
    }
  }
 
  else {
    // Vercel Blob
    const arrayBuffer = file instanceof Buffer ? file : await (file as Blob).arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const blob = await put(uniqueFilename, buffer, {
      access: 'public',
      contentType: options?.contentType || 'application/pdf',
    })
    
    return {
      url: blob.url,
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
  if (IS_LOCAL) {
    const filepath = path.join(LOCAL_STORAGE_DIR, pathname)
    try {
      await fs.unlink(filepath)
    }
    catch (error) {
      console.error('Failed to delete local file:', error)
    }
  }
  else {
    await del(pathname)
  }
}

/**
 * Get file from storage
 */
export async function getFile(pathname: string): Promise<Buffer> {
  if (IS_LOCAL) {
    // Normalize: strip leading /api/storage/ URL prefix if present
    const filename = pathname.replace(/^\/api\/storage\//, '')
    const filepath = path.join(LOCAL_STORAGE_DIR, filename)
    return await fs.readFile(filepath)
  }
  else {
    const response = await fetch(`https://blob.vercel-storage.com/${pathname}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`)
    }
    return Buffer.from(await response.arrayBuffer())
  }
}

/**
 * Check if file exists
 */
export async function fileExists(pathname: string): Promise<boolean> {
  if (IS_LOCAL) {
    const filepath = path.join(LOCAL_STORAGE_DIR, pathname)
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
      await head(pathname)
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
          url: `/api/storage/${file}`,
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
      url: blob.url,
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
  if (IS_LOCAL) {
    return `/api/storage/${pathname}`
  }
  else {
    // For Vercel Blob, URLs are already public, but you could implement signed URLs if needed
    return `https://blob.vercel-storage.com/${pathname}`
  }
}

export { IS_LOCAL, LOCAL_STORAGE_DIR }
