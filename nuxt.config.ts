// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxt/eslint',
  ],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'tapPDF - Quick PDF Editing',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Edit and export PDFs with a simple one-time payment. No account needed.' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Pacifico&display=swap' },
      ],
    },
  },

  runtimeConfig: {
    // Server-side only
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    blobReadWriteToken: process.env.BLOB_READ_WRITE_TOKEN || '',
    postgresUrl: process.env.POSTGRES_URL || '',

    // Exposed to client
    public: {
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      baseUrl: process.env.BASE_URL || 'http://localhost:3000',
      paymentAmount: parseInt(process.env.PAYMENT_AMOUNT || '99'),
      paymentCurrency: process.env.PAYMENT_CURRENCY || 'eur',
      fileExpiryHours: parseInt(process.env.FILE_EXPIRY_HOURS || '24'),
    },
  },

  nitro: {
    preset: 'vercel',
    experimental: {
      openAPI: true,
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  eslint: {
    config: {
      stylistic: true,
    },
  },

  // Optimize for production
  build: {
    transpile: ['pdfjs-dist'],
  },

  vite: {
    optimizeDeps: {
      include: ['pdfjs-dist', 'fabric'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'pdf-viewer': ['pdfjs-dist'],
            'pdf-editor': ['fabric'],
            'pdf-generator': ['pdf-lib'],
            'payments': ['@stripe/stripe-js'],
          },
        },
      },
    },
  },
})
