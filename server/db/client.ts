/**
 * Database client with in-memory mock for local development
 */

import { sql } from '@vercel/postgres'
import { promises as fs } from 'fs'
import path from 'path'
import { nanoid } from 'nanoid'
import type { Document, Payment } from './schema'
import { IS_MOCK_DB } from './schema'

// In-memory storage for mock mode
const mockDocuments = new Map<string, Document>()
const mockPayments = new Map<string, Payment>()

const MOCK_DB_FILE = path.join(process.cwd(), '.storage', 'mock-db.json')

async function persistMockDB() {
  if (!IS_MOCK_DB) return
  try {
    const data = {
      documents: Object.fromEntries(mockDocuments),
      payments: Object.fromEntries(mockPayments),
    }
    await fs.mkdir(path.dirname(MOCK_DB_FILE), { recursive: true })
    await fs.writeFile(MOCK_DB_FILE, JSON.stringify(data, null, 2))
  } catch { /* non-fatal */ }
}

// Restore on module load
;(async () => {
  if (!IS_MOCK_DB) return
  try {
    const raw = await fs.readFile(MOCK_DB_FILE, 'utf-8')
    const data = JSON.parse(raw)
    if (data.documents) {
      for (const [k, v] of Object.entries(data.documents as Record<string, Document>)) {
        // Revive Date objects
        v.created_at = new Date(v.created_at)
        v.expires_at = new Date(v.expires_at)
        mockDocuments.set(k, v)
      }
    }
    if (data.payments) {
      for (const [k, v] of Object.entries(data.payments as Record<string, Payment>)) {
        mockPayments.set(k, v)
      }
    }
    console.log('📊 Mock DB: Restored', mockDocuments.size, 'documents from disk')
  } catch { /* file doesn't exist yet, that's fine */ }
})()

/**
 * Create a new document record
 */
export async function createDocument(data: {
  uploadPath: string
  overlayPath?: string | null
  finalPath?: string | null
  paymentStatus?: 'pending' | 'paid' | 'failed'
  expiresAt: Date
}): Promise<Document> {
  if (IS_MOCK_DB) {
    const doc: Document = {
      id: nanoid(),
      upload_path: data.uploadPath,
      overlay_path: data.overlayPath || null,
      final_path: data.finalPath || null,
      payment_status: data.paymentStatus || 'pending',
      created_at: new Date(),
      expires_at: data.expiresAt
    }
    mockDocuments.set(doc.id, doc)
    await persistMockDB()
    return doc
  }

  const result = await sql<Document>`
    INSERT INTO documents (upload_path, overlay_path, final_path, payment_status, expires_at)
    VALUES (${data.uploadPath}, ${data.overlayPath}, ${data.finalPath}, ${data.paymentStatus || 'pending'}, ${data.expiresAt.toISOString()})
    RETURNING *
  `
  
  return result.rows[0]
}

/**
 * Get document by ID
 */
export async function getDocument(id: string): Promise<Document | null> {
  if (IS_MOCK_DB) {
    return mockDocuments.get(id) || null
  }

  const result = await sql<Document>`
    SELECT * FROM documents WHERE id = ${id}
  `
  
  return result.rows[0] || null
}

/**
 * Update document overlay path
 */
export async function updateDocumentOverlay(
  id: string,
  overlayPath: string
): Promise<Document | null> {
  if (IS_MOCK_DB) {
    const doc = mockDocuments.get(id)
    if (doc) {
      doc.overlay_path = overlayPath
      mockDocuments.set(id, doc)
      await persistMockDB()
      return doc
    }
    return null
  }

  const result = await sql<Document>`
    UPDATE documents
    SET overlay_path = ${overlayPath}
    WHERE id = ${id}
    RETURNING *
  `
  
  return result.rows[0] || null
}

/**
 * Update document final path and payment status
 */
export async function updateDocumentFinal(
  id: string,
  finalPath: string,
  paymentStatus: 'pending' | 'paid' | 'failed' = 'paid'
): Promise<Document | null> {
  if (IS_MOCK_DB) {
    const doc = mockDocuments.get(id)
    if (doc) {
      doc.final_path = finalPath
      doc.payment_status = paymentStatus
      mockDocuments.set(id, doc)
      await persistMockDB()
      return doc
    }
    return null
  }

  const result = await sql<Document>`
    UPDATE documents
    SET final_path = ${finalPath}, payment_status = ${paymentStatus}
    WHERE id = ${id}
    RETURNING *
  `
  
  return result.rows[0] || null
}

/**
 * Delete expired documents
 */
export async function deleteExpiredDocuments(): Promise<number> {
  if (IS_MOCK_DB) {
    const now = new Date()
    let count = 0
    for (const [id, doc] of mockDocuments.entries()) {
      if (doc.expires_at < now) {
        mockDocuments.delete(id)
        count++
      }
    }
    console.log('📊 Mock DB: Deleted', count, 'expired documents')
    return count
  }

  const result = await sql`
    DELETE FROM documents
    WHERE expires_at < NOW()
  `
  
  return result.rowCount || 0
}

/**
 * Create a new payment record
 */
export async function createPayment(
  stripeIntentId: string,
  documentId: string,
  amount: number,
  currency: string,
  status: string
): Promise<Payment> {
  if (IS_MOCK_DB) {
    const payment: Payment = {
      id: nanoid(),
      stripe_intent_id: stripeIntentId,
      document_id: documentId,
      amount,
      currency,
      status,
      created_at: new Date()
    }
    mockPayments.set(payment.id, payment)
    console.log('📊 Mock DB: Created payment', payment.id)
    return payment
  }

  const result = await sql<Payment>`
    INSERT INTO payments (stripe_intent_id, document_id, amount, currency, status)
    VALUES (${stripeIntentId}, ${documentId}, ${amount}, ${currency}, ${status})
    RETURNING *
  `
  
  return result.rows[0]
}

/**
 * Get payment by Stripe intent ID
 */
export async function getPaymentByIntent(stripeIntentId: string): Promise<Payment | null> {
  if (IS_MOCK_DB) {
    for (const payment of mockPayments.values()) {
      if (payment.stripe_intent_id === stripeIntentId) {
        return payment
      }
    }
    return null
  }

  const result = await sql<Payment>`
    SELECT * FROM payments WHERE stripe_intent_id = ${stripeIntentId}
  `
  
  return result.rows[0] || null
}

/**
 * Update payment status
 */
export async function updatePaymentStatus(
  stripeIntentId: string,
  status: string
): Promise<Payment | null> {
  if (IS_MOCK_DB) {
    for (const [id, payment] of mockPayments.entries()) {
      if (payment.stripe_intent_id === stripeIntentId) {
        payment.status = status
        mockPayments.set(id, payment)
        console.log('📊 Mock DB: Updated payment status', stripeIntentId, status)
        return payment
      }
    }
    return null
  }

  const result = await sql<Payment>`
    UPDATE payments
    SET status = ${status}
    WHERE stripe_intent_id = ${stripeIntentId}
    RETURNING *
  `
  
  return result.rows[0] || null
}

/**
 * Get all documents (for debugging)
 */
export async function getAllDocuments(): Promise<Document[]> {
  if (IS_MOCK_DB) {
    return Array.from(mockDocuments.values())
  }

  const result = await sql<Document>`
    SELECT * FROM documents ORDER BY created_at DESC
  `
  
  return result.rows
}

/**
 * Get all payments (for debugging)
 */
export async function getAllPayments(): Promise<Payment[]> {
  if (IS_MOCK_DB) {
    return Array.from(mockPayments.values())
  }

  const result = await sql<Payment>`
    SELECT * FROM payments ORDER BY created_at DESC
  `
  
  return result.rows
}
