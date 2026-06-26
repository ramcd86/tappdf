/**
 * Stripe client singleton and utility functions
 */

import Stripe from 'stripe'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''
const IS_MOCK = !STRIPE_SECRET_KEY || STRIPE_SECRET_KEY.startsWith('mock_')

let stripeInstance: Stripe | null = null

/**
 * Get Stripe client instance (or mock for local development)
 */
export function getStripeClient(): Stripe {
  if (!stripeInstance && !IS_MOCK) {
    stripeInstance = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    })
  }
  
  // Return actual Stripe or mock
  if (IS_MOCK) {
    console.warn('⚠️  Using mock Stripe client - payments will not be processed')
    return createMockStripe()
  }
  
  return stripeInstance!
}

/**
 * Create a mock Stripe client for local testing
 */
function createMockStripe(): Stripe {
  return {
    paymentIntents: {
      create: async (params: Stripe.PaymentIntentCreateParams) => {
        console.log('🔷 Mock Stripe: Creating payment intent', params)
        return {
          id: `pi_mock_${Date.now()}`,
          client_secret: `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
          amount: params.amount,
          currency: params.currency,
          status: 'requires_payment_method',
          metadata: params.metadata || {},
        } as Stripe.PaymentIntent
      },
      retrieve: async (id: string) => {
        console.log('🔷 Mock Stripe: Retrieving payment intent', id)
        return {
          id,
          amount: 99,
          currency: 'eur',
          status: 'succeeded',
          metadata: {},
        } as Stripe.PaymentIntent
      },
      update: async (id: string, params: Stripe.PaymentIntentUpdateParams) => {
        console.log('🔷 Mock Stripe: Updating payment intent', id, params)
        return {
          id,
          amount: 99,
          currency: 'eur',
          status: 'succeeded',
          metadata: params.metadata || {},
        } as Stripe.PaymentIntent
      },
    },
    webhooks: {
      constructEvent: (payload: string | Buffer, _signature: string, _secret: string) => {
        console.log('🔷 Mock Stripe: Constructing webhook event')
        // In mock mode, just return a parsed event
        try {
          const event = JSON.parse(payload.toString())
          return event
        }
        catch {
          throw new Error('Invalid webhook payload')
        }
      },
    },
  } as unknown as Stripe
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
): Stripe.Event {
  const stripe = getStripeClient()
  return stripe.webhooks.constructEvent(payload, signature, secret)
}

/**
 * Create a payment intent
 */
export async function createPaymentIntent(
  amount: number,
  currency: string = 'eur',
  metadata?: Record<string, string>,
): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient()
  return await stripe.paymentIntents.create({
    amount,
    currency,
    metadata,
    automatic_payment_methods: {
      enabled: true,
    },
  })
}

/**
 * Retrieve a payment intent
 */
export async function getPaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient()
  return await stripe.paymentIntents.retrieve(id)
}

export { IS_MOCK as IS_STRIPE_MOCK }
