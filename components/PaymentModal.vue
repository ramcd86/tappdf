<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click.self="close"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
      <div class="flex justify-between items-start mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Download PDF</h2>
          <p class="text-sm text-gray-600 mt-1">One-time payment • No subscription</p>
        </div>
        <button
          class="text-gray-400 hover:text-gray-600"
          @click="close"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div v-if="!processing">
        <div class="mb-6 p-4 bg-gray-50 rounded-lg">
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">Total</span>
            <span class="text-2xl font-bold text-gray-900">€0.99</span>
          </div>
        </div>

        <!-- Dev / mock mode -->
        <div v-if="isMockMode" class="space-y-3">
          <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p class="text-xs text-yellow-800 font-medium">Dev mode — Stripe not configured. Using mock payment.</p>
          </div>
          <button class="w-full btn-primary py-3" @click="handleMockPayment">
            Simulate Payment &amp; Download
          </button>
        </div>

        <!-- Real Stripe mode -->
        <template v-else>
          <div id="stripe-payment-element" ref="paymentElementRef" class="mb-6 min-h-[100px]" />
          <button
            class="w-full btn-primary py-3"
            :disabled="!canPay"
            @click="handleStripePayment"
          >
            Pay €0.99
          </button>
          <p class="text-xs text-gray-500 text-center mt-4">
            Secure payment powered by Stripe
          </p>
        </template>
      </div>

      <div v-else class="py-8 text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
        <p class="text-sm text-gray-600">{{ processingMessage }}</p>
      </div>

      <div v-if="errorMessage" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
        <p class="text-sm text-red-800">{{ errorMessage }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  documentId?: string
}>()

const payment = usePayment()

const isOpen = ref(false)
const processing = ref(false)
const processingMessage = ref('Processing payment...')
const canPay = ref(false)
const errorMessage = ref<string | null>(null)
const paymentElementRef = ref<HTMLElement | null>(null)

const isMockMode = ref(false)

async function open() {
  isOpen.value = true
  errorMessage.value = null
  canPay.value = false
  processing.value = false
  isMockMode.value = false

  if (props.documentId) {
    const success = await payment.createPaymentIntent(props.documentId, [])
    if (!success) {
      errorMessage.value = payment.state.error || 'Failed to initialize payment'
      return
    }
    isMockMode.value = payment.state.isMock
  } else {
    isMockMode.value = true
  }

  if (!isMockMode.value) {
    await nextTick()
    if (paymentElementRef.value) {
      const elements = await payment.createPaymentElement('stripe-payment-element')
      if (elements) {
        const el = elements.getElement('payment')
        el?.on('change', (e: any) => { canPay.value = e.complete })
      }
    }
  } else {
    canPay.value = true
  }
}

function close() {
  if (!processing.value) {
    isOpen.value = false
    errorMessage.value = null
  }
}

async function handleMockPayment() {
  if (!props.documentId) return
  processing.value = true
  processingMessage.value = 'Generating your PDF...'
  errorMessage.value = null

  try {
    const result = await $fetch<{ success: boolean; downloadUrl: string }>('/api/generate', {
      method: 'POST',
      body: { documentId: props.documentId },
    })
    if (result.downloadUrl) {
      processingMessage.value = 'Download starting...'
      const a = document.createElement('a')
      a.href = result.downloadUrl
      a.download = `tappdf-${props.documentId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      await new Promise(resolve => setTimeout(resolve, 500))
      close()
    }
  }
  catch (err: any) {
    errorMessage.value = err.data?.message || 'Failed to generate PDF. Please try again.'
  }
  finally {
    processing.value = false
  }
}

async function handleStripePayment() {
  processing.value = true
  processingMessage.value = 'Processing payment...'
  errorMessage.value = null

  const returnUrl = `${window.location.origin}/payment-success?documentId=${props.documentId}`
  const success = await payment.submitPayment(returnUrl)

  if (!success) {
    errorMessage.value = payment.state.error || 'Payment failed. Please try again.'
    processing.value = false
  }
  // On success Stripe redirects to returnUrl automatically
}

defineExpose({ open, close })
</script>
