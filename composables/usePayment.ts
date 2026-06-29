/**
 * Composable for payment flow coordination
 * Handles Stripe payment integration
 */

import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js'
import type { OverlayObject } from '~/types/overlay'

export interface PaymentState {
  clientSecret: string | null
  paymentIntentId: string | null
  processing: boolean
  error: string | null
  success: boolean
  isMock: boolean
}

export function usePayment() {
  const config = useRuntimeConfig()
  const state = reactive<PaymentState>({
    clientSecret: null,
    paymentIntentId: null,
    processing: false,
    error: null,
    success: false,
    isMock: false,
  })

  let stripe: Stripe | null = null
  let elements: StripeElements | null = null

  /**
   * Initialize Stripe
   */
  async function initStripe() {
    if (stripe)
      return stripe

    const publishableKey = config.public.stripePublishableKey as string
    if (!publishableKey) {
      console.error('Stripe publishable key not configured')
      return null
    }

    stripe = await loadStripe(publishableKey)
    return stripe
  }

  /**
   * Create payment intent
   */
  async function createPaymentIntent(
    documentId: string,
    _overlayData?: OverlayObject[],
  ): Promise<boolean> {
    state.processing = true
    state.error = null

    if (config.public.paymentMockMode) {
      state.clientSecret = null
      state.paymentIntentId = `pi_mock_client_${Date.now()}`
      state.isMock = true
      state.processing = false
      return true
    }

    try {
      const response = await $fetch<{
        success: boolean
        clientSecret: string
        paymentIntentId: string
        amount: number
        currency: string
        isMock: boolean
      }>('/api/payment/create-intent', {
        method: 'POST',
        body: { documentId },
      })

      state.clientSecret = response.clientSecret
      state.paymentIntentId = response.paymentIntentId
      state.isMock = response.isMock ?? false

      return true
    }
    catch (error: any) {
      console.error('Failed to create payment intent:', error)
      state.error = error.data?.message || 'Failed to initialize payment'
      return false
    }
    finally {
      state.processing = false
    }
  }

  /**
   * Create Stripe payment element
   */
  async function createPaymentElement(elementId: string): Promise<StripeElements | null> {
    if (!state.clientSecret) {
      state.error = 'Payment not initialized'
      return null
    }

    const stripeInstance = await initStripe()
    if (!stripeInstance) {
      state.error = 'Failed to load Stripe'
      return null
    }

    elements = stripeInstance.elements({
      clientSecret: state.clientSecret,
    })

    const paymentElement = elements.create('payment')
    paymentElement.mount(`#${elementId}`)

    return elements
  }

  /**
   * Submit payment
   */
  async function submitPayment(returnUrl: string): Promise<boolean> {
    if (!stripe || !elements) {
      state.error = 'Payment not initialized'
      return false
    }

    state.processing = true
    state.error = null

    try {
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
      })

      if (submitError) {
        state.error = submitError.message || 'Payment failed'
        return false
      }

      state.success = true
      return true
    }
    catch (error: any) {
      console.error('Payment submission error:', error)
      state.error = error.message || 'Payment failed'
      return false
    }
    finally {
      state.processing = false
    }
  }

  /**
   * Process payment (for testing with mock mode)
   */
  async function processPayment(
    documentId: string,
    overlayData: OverlayObject[],
  ): Promise<{ success: boolean, downloadUrl?: string }> {
    // Create payment intent
    const created = await createPaymentIntent(documentId, overlayData)
    if (!created) {
      return { success: false }
    }

    // In mock mode, simulate successful payment
    const isMockMode = config.public.paymentMockMode || !config.public.stripePublishableKey || config.public.stripePublishableKey.startsWith('pk_test_mock')

    if (isMockMode) {
      console.log('🔷 Mock payment mode - simulating payment success')

      // Simulate webhook call
      try {
        await $fetch('/api/payment/webhook', {
          method: 'POST',
          headers: {
            'stripe-signature': 'mock_signature',
          },
          body: JSON.stringify({
            type: 'payment_intent.succeeded',
            data: {
              object: {
                id: state.paymentIntentId,
                status: 'succeeded',
              },
            },
          }),
        })

        // Wait a bit for PDF generation
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Get download URL
        const downloadUrl = `/api/download/${documentId}`
        state.success = true

        return { success: true, downloadUrl }
      }
      catch (error) {
        console.error('Mock payment flow error:', error)
        return { success: false }
      }
    }

    // Real Stripe flow would redirect to payment page
    return { success: true }
  }

  /**
   * Reset payment state
   */
  function reset() {
    state.clientSecret = null
    state.paymentIntentId = null
    state.processing = false
    state.error = null
    state.success = false

    if (elements) {
      elements = null
    }
  }

  return {
    state: readonly(state),
    initStripe,
    createPaymentIntent,
    createPaymentElement,
    submitPayment,
    processPayment,
    reset,
  }
}
