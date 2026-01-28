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

        <!-- Stripe Payment Element will be mounted here -->
        <div ref="paymentElement" class="mb-6" />

        <button
          class="w-full btn-primary py-3"
          :disabled="!canPay"
          @click="handlePayment"
        >
          Pay €0.99
        </button>

        <p class="text-xs text-gray-500 text-center mt-4">
          Secure payment powered by Stripe
        </p>
      </div>

      <div v-else class="py-8 text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
        <p class="text-sm text-gray-600">Processing payment...</p>
      </div>

      <div v-if="error" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
        <p class="text-sm text-red-800">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Stripe payment modal
const isOpen = ref(false)
const processing = ref(false)
const canPay = ref(false)
const error = ref<string | null>(null)
const paymentElement = ref<HTMLElement | null>(null)

const open = () => {
  isOpen.value = true
  // TODO: Initialize Stripe payment element
}

const close = () => {
  if (!processing.value) {
    isOpen.value = false
    error.value = null
  }
}

const handlePayment = async () => {
  processing.value = true
  error.value = null

  try {
    // TODO: Implement Stripe payment confirmation
    // 1. Confirm payment with Stripe
    // 2. Wait for webhook confirmation
    // 3. Redirect to success page
    await new Promise(resolve => setTimeout(resolve, 2000))
  } catch (err) {
    error.value = 'Payment failed. Please try again.'
    console.error('Payment error:', err)
  } finally {
    processing.value = false
  }
}

defineExpose({ open })
</script>
