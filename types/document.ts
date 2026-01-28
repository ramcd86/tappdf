export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export interface Document {
  id: string
  uploadPath: string
  overlayPath: string | null
  finalPath: string | null
  paymentStatus: PaymentStatus
  createdAt: Date
  expiresAt: Date
}

export interface CreateDocumentInput {
  uploadPath: string
  expiresAt: Date
}

export interface UpdateDocumentInput {
  id: string
  overlayPath?: string
  finalPath?: string
  paymentStatus?: PaymentStatus
}
