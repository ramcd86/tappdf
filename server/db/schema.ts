/**
 * Database schema definition
 * Supports both Vercel Postgres and in-memory mock for local development
 */

import { getSql, IS_MOCK_DB } from './sql'

export interface Document {
  id: string
  upload_path: string
  overlay_path: string | null
  final_path: string | null
  payment_status: 'pending' | 'paid' | 'failed'
  created_at: Date
  expires_at: Date
}

export interface Payment {
  id: string
  stripe_intent_id: string
  document_id: string
  amount: number
  currency: string
  status: string
  created_at: Date
}

/**
 * Initialize database schema
 */
export async function initializeSchema() {
  if (IS_MOCK_DB) {
    console.log('📊 Using in-memory database (mock)')
    return
  }

  try {
    const sql = getSql()

    // Create documents table
    await sql`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        upload_path TEXT NOT NULL,
        overlay_path TEXT,
        final_path TEXT,
        payment_status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      )
    `

    // Create index on expires_at
    await sql`
      CREATE INDEX IF NOT EXISTS idx_documents_expires ON documents(expires_at)
    `

    // Create payments table
    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        stripe_intent_id TEXT UNIQUE NOT NULL,
        document_id UUID REFERENCES documents(id),
        amount INTEGER NOT NULL,
        currency VARCHAR(3) DEFAULT 'eur',
        status VARCHAR(20) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // Create indexes on payments
    await sql`
      CREATE INDEX IF NOT EXISTS idx_payments_stripe ON payments(stripe_intent_id)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_payments_document ON payments(document_id)
    `

    console.log('✅ Database schema initialized')
  } catch (error) {
    console.error('Failed to initialize database schema:', error)
  }
}

export { IS_MOCK_DB }
