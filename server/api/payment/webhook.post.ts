/**
 * Stripe webhook handler
 * POST /api/payment/webhook
 */

import { verifyWebhookSignature } from '~/server/utils/stripe'
import { updatePaymentStatus, getPaymentByIntent, getDocument } from '~/server/db/client'

export default defineEventHandler(async (event) => {
  try {
    // Get raw body and signature
    const body = await readRawBody(event)
    const signature = getHeader(event, 'stripe-signature')
    
    if (!body || !signature) {
      throw createError({
        statusCode: 400,
        message: 'Missing webhook body or signature'
      })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'mock_webhook_secret'
    
    // Verify webhook signature
    let stripeEvent
    try {
      stripeEvent = verifyWebhookSignature(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      throw createError({
        statusCode: 400,
        message: 'Invalid webhook signature'
      })
    }

    // Handle different event types
    switch (stripeEvent.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(stripeEvent.data.object)
        break
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(stripeEvent.data.object)
        break
        
      case 'payment_intent.canceled':
        await handlePaymentCanceled(stripeEvent.data.object)
        break
        
      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`)
    }

    // Return success response
    return { received: true }
  } catch (error: any) {
    console.error('Webhook error:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      message: 'Webhook processing failed'
    })
  }
})

/**
 * Handle successful payment
 */
async function handlePaymentSuccess(paymentIntent: any) {
  console.log('💳 Payment succeeded:', paymentIntent.id)
  
  // Update payment status
  await updatePaymentStatus(paymentIntent.id, 'succeeded')
  
  // Get payment record to find document ID
  const payment = await getPaymentByIntent(paymentIntent.id)
  
  if (!payment) {
    console.error('Payment record not found:', paymentIntent.id)
    return
  }

  // Trigger PDF generation asynchronously
  // In production, you might want to use a queue system
  triggerPDFGeneration(payment.document_id).catch(error => {
    console.error('Failed to trigger PDF generation:', error)
  })
}

/**
 * Handle failed payment
 */
async function handlePaymentFailure(paymentIntent: any) {
  console.log('❌ Payment failed:', paymentIntent.id)
  
  await updatePaymentStatus(paymentIntent.id, 'failed')
}

/**
 * Handle canceled payment
 */
async function handlePaymentCanceled(paymentIntent: any) {
  console.log('🚫 Payment canceled:', paymentIntent.id)
  
  await updatePaymentStatus(paymentIntent.id, 'canceled')
}

/**
 * Trigger PDF generation (async)
 */
async function triggerPDFGeneration(documentId: string) {
  try {
    // Call the generate endpoint internally
    const config = useRuntimeConfig()
    const baseUrl = config.public.baseUrl || 'http://localhost:3000'
    
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ documentId })
    })
    
    if (!response.ok) {
      throw new Error(`Generate API returned ${response.status}`)
    }
    
    const result = await response.json()
    console.log('✅ PDF generated:', result)
  } catch (error) {
    console.error('PDF generation trigger failed:', error)
    throw error
  }
}
