/**
 * Composable for file upload handling
 * Manages file selection, validation, and upload to the server
 */

import type { Ref } from 'vue'

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface UploadResult {
  documentId: string
  uploadUrl: string
  expiresAt: string
  size: number
}

export interface UploadError {
  message: string
  code?: string
}

export function useFileUpload() {
  const uploading = ref(false)
  const progress = ref<UploadProgress | null>(null)
  const error = ref<UploadError | null>(null)
  const result = ref<UploadResult | null>(null)

  /**
   * Validate PDF file
   */
  function validateFile(file: File): UploadError | null {
    // Check file type
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      return { message: 'Please select a PDF file', code: 'INVALID_TYPE' }
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return { message: 'File size must be less than 10MB', code: 'FILE_TOO_LARGE' }
    }

    return null
  }

  /**
   * Upload file to server
   */
  async function uploadFile(file: File): Promise<UploadResult | null> {
    // Reset state
    error.value = null
    result.value = null
    progress.value = null

    // Validate file
    const validationError = validateFile(file)
    if (validationError) {
      error.value = validationError
      return null
    }

    try {
      uploading.value = true

      // Create form data
      const formData = new FormData()
      formData.append('file', file)

      // Upload with progress tracking
      const response = await $fetch<UploadResult>('/api/upload', {
        method: 'POST',
        body: formData,
        onRequest: () => {
          progress.value = { loaded: 0, total: file.size, percentage: 0 }
        },
        onResponse: () => {
          progress.value = { loaded: file.size, total: file.size, percentage: 100 }
        },
      })

      result.value = response
      return response
    }
    catch (err: any) {
      console.error('Upload error:', err)
      error.value = {
        message: err.data?.message || 'Failed to upload file',
        code: err.statusCode?.toString() || 'UPLOAD_ERROR',
      }
      return null
    }
    finally {
      uploading.value = false
    }
  }

  /**
   * Reset upload state
   */
  function reset() {
    uploading.value = false
    progress.value = null
    error.value = null
    result.value = null
  }

  return {
    uploading: readonly(uploading),
    progress: readonly(progress),
    error: readonly(error),
    result: readonly(result),
    uploadFile,
    validateFile,
    reset,
  }
}
