export type PaymentCurrency = 'usd' | 'eur' | 'gbp'
export type PaymentStatusType = 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled'

export interface Payment {
  id: string
  stripeIntentId: string
  documentId: string
  amount: number
  currency: PaymentCurrency
  status: PaymentStatusType
  createdAt: Date
}

export interface CreatePaymentIntentInput {
  documentId: string
  amount: number
  currency: PaymentCurrency
}

export interface CreatePaymentIntentResponse {
  clientSecret: string
  paymentIntentId: string
}

export interface StripeWebhookEvent {
  id: string
  type: string
  data: {
    object: any
  }
}
