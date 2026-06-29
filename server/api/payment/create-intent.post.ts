import { createPaymentIntent, IS_STRIPE_MOCK } from '~/server/utils/stripe'
import { createPayment, getDocument } from '~/server/db/client'

interface CreateIntentRequest {
  documentId: string
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<CreateIntentRequest>(event)

    if (!body.documentId) {
      throw createError({ statusCode: 400, message: 'Document ID is required' })
    }

    const document = await getDocument(body.documentId)

    if (!document) {
      throw createError({ statusCode: 404, message: 'Document not found' })
    }

    if (document.expires_at < new Date()) {
      throw createError({ statusCode: 410, message: 'Document has expired' })
    }

    const amount = parseInt(process.env.PAYMENT_AMOUNT || '99')
    const currency = process.env.PAYMENT_CURRENCY || 'eur'

    const paymentIntent = await createPaymentIntent(amount, currency, {
      documentId: body.documentId,
    })

    await createPayment(
      paymentIntent.id,
      body.documentId,
      amount,
      currency,
      paymentIntent.status,
    )

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
      currency,
      isMock: IS_STRIPE_MOCK,
    }
  }
  catch (error: any) {
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, message: 'Failed to create payment intent' })
  }
})
