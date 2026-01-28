# tapPDF - Technical Implementation Scaffolding

## Project Setup

### Initial Dependencies
```
Core Framework:
- nuxt 3.x
- typescript
- @nuxt/eslint
- @nuxt/ui (optional, or shadcn-vue)

PDF Handling:
- pdfjs-dist
- pdf-lib
- fabric

Payments:
- @stripe/stripe-js
- stripe (server SDK)

Storage & Database:
- @vercel/blob
- @vercel/postgres
- drizzle-orm (or prisma)

Utilities:
- zod (validation)
- date-fns
- nanoid
```

---

## Directory Structure

```
tapPDF/
├── pages/
│   ├── index.vue                 # Landing page
│   ├── editor.vue                # Main PDF editor page
│   └── payment-success.vue       # Post-payment redirect
│
├── components/
│   ├── PDFViewer.vue            # PDF.js viewer wrapper
│   ├── OverlayCanvas.vue        # Fabric.js canvas overlay
│   ├── Toolbar.vue              # Edit tools (text, image, etc)
│   ├── PageNavigator.vue        # Page selection/thumbnails
│   ├── PaymentModal.vue         # Stripe payment element
│   └── UploadZone.vue           # Drag & drop uploader
│
├── composables/
│   ├── usePDF.ts                # PDF.js integration logic
│   ├── useOverlay.ts            # Overlay state management
│   ├── usePayment.ts            # Payment flow coordination
│   └── useFileUpload.ts         # Upload handling
│
├── server/
│   ├── api/
│   │   ├── upload.post.ts       # File upload handler
│   │   ├── payment/
│   │   │   ├── create-intent.post.ts    # Stripe intent creation
│   │   │   └── webhook.post.ts          # Stripe webhook handler
│   │   ├── generate.post.ts     # PDF generation endpoint
│   │   └── download/[id].get.ts # Signed download URL
│   │
│   ├── utils/
│   │   ├── pdf-generator.ts     # pdf-lib wrapper
│   │   ├── storage.ts           # Vercel Blob operations
│   │   └── stripe.ts            # Stripe client singleton
│   │
│   └── db/
│       ├── schema.ts            # Database schema (Drizzle/Prisma)
│       └── client.ts            # DB connection
│
├── types/
│   ├── overlay.ts               # Overlay JSON schema types
│   ├── document.ts              # Document metadata types
│   └── payment.ts               # Payment types
│
├── public/
│   └── pdf.worker.js            # PDF.js worker (copied from node_modules)
│
└── nuxt.config.ts
```

---

## Database Schema (SQL)

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_path TEXT NOT NULL,
    overlay_path TEXT,
    final_path TEXT,
    payment_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_documents_expires ON documents(expires_at);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_intent_id TEXT UNIQUE NOT NULL,
    document_id UUID REFERENCES documents(id),
    amount INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'eur',
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_stripe ON payments(stripe_intent_id);
CREATE INDEX idx_payments_document ON payments(document_id);
```

---

## TypeScript Type Definitions

```typescript
// types/overlay.ts
export interface OverlayObject {
  id: string
  page: number
  type: 'text' | 'image' | 'shape' | 'highlight' | 'drawing'
  x: number
  y: number
  width?: number
  height?: number
  rotation?: number
  data: Record<string, any>
}

export interface TextOverlay extends OverlayObject {
  type: 'text'
  data: {
    text: string
    fontSize: number
    fontFamily?: string
    color: string
  }
}

export interface ImageOverlay extends OverlayObject {
  type: 'image'
  data: {
    src: string
    opacity?: number
  }
}

export interface OverlayState {
  objects: OverlayObject[]
  currentPage: number
  totalPages: number
}

// types/document.ts
export interface Document {
  id: string
  uploadPath: string
  overlayPath: string | null
  finalPath: string | null
  paymentStatus: 'pending' | 'paid' | 'failed'
  createdAt: Date
  expiresAt: Date
}

// types/payment.ts
export interface Payment {
  id: string
  stripeIntentId: string
  documentId: string
  amount: number
  currency: string
  status: string
  createdAt: Date
}
```

---

## Core API Endpoints

### POST /api/upload
**Purpose:** Accept PDF file, store in Blob, create document record

```typescript
Request:
- multipart/form-data with PDF file

Response:
{
  documentId: string
  uploadUrl: string
  expiresAt: string
}
```

### POST /api/payment/create-intent
**Purpose:** Create Stripe PaymentIntent for document export

```typescript
Request:
{
  documentId: string
  overlayData: OverlayObject[]
}

Response:
{
  clientSecret: string
  paymentIntentId: string
}
```

### POST /api/payment/webhook
**Purpose:** Receive Stripe webhook events, trigger PDF generation

```typescript
Request:
- Stripe webhook payload

Actions:
- Verify webhook signature
- Update payment status
- Trigger PDF generation if payment succeeded
```

### POST /api/generate
**Purpose:** Generate final PDF with overlays (called after payment verification)

```typescript
Request:
{
  documentId: string
}

Response:
{
  downloadUrl: string
  expiresAt: string
}
```

### GET /api/download/[id]
**Purpose:** Return signed download URL or redirect to blob

```typescript
Response:
- Redirect to signed Blob URL
- Or direct file stream
```

---

## Implementation Phases

### Phase 0: Project Setup ✅
- [x] Set up Nuxt 3 project
- [x] Install core dependencies
- [x] Configure Tailwind CSS
- [x] Create nuxt.config.ts with runtime config
- [x] Initialize git repository
- [x] Create .gitignore and .env.example

### Phase 1: Core Upload & Viewing
- [ ] Create directory structure
- [ ] Configure Vercel Blob storage
- [ ] Implement file upload endpoint
- [ ] Integrate PDF.js for rendering
- [ ] Basic page navigation

### Phase 2: Overlay Editing
- [ ] Integrate Fabric.js canvas
- [ ] Implement text tool
- [ ] Implement image upload tool
- [ ] Object selection & manipulation
- [ ] Overlay state management
- [ ] Auto-save overlay JSON

### Phase 3: Payment Integration
- [ ] Set up Stripe account
- [ ] Configure webhook endpoint
- [ ] Implement payment intent creation
- [ ] Build payment modal UI
- [ ] Test webhook flow

### Phase 4: PDF Generation
- [ ] Implement pdf-lib generation logic
- [ ] Apply overlay objects to PDF
- [ ] Store generated PDF in Blob
- [ ] Create signed download URLs

### Phase 5: Database & Cleanup
- [ ] Set up Vercel Postgres
- [ ] Implement schema
- [ ] Add document/payment tracking
- [ ] Create cleanup cron job

### Phase 6: Polish & Testing
- [ ] Error handling
- [ ] Loading states
- [ ] Mobile responsiveness
- [ ] E2E payment testing
- [ ] Performance optimization

---

## Environment Variables

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Vercel Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_...
POSTGRES_URL=postgres://...
POSTGRES_PRISMA_URL=postgres://...
POSTGRES_URL_NON_POOLING=postgres://...

# App Config
BASE_URL=http://localhost:3000
PAYMENT_AMOUNT=99  # cents
PAYMENT_CURRENCY=eur
FILE_EXPIRY_HOURS=24
```

---

## Critical Implementation Notes

### PDF.js Integration
- Must copy worker file to public directory
- Use canvas rendering mode (not SVG)
- Calculate proper scale for responsive viewing
- Handle async page loading

### Fabric.js Canvas
- One canvas per PDF page
- Sync dimensions with PDF.js rendered size
- Serialize/deserialize to JSON for persistence
- Handle z-index layering

### PDF Generation with pdf-lib
- Load original PDF
- Iterate overlay objects by page
- Draw each object type appropriately
- Handle coordinate transformation
- Flatten to single output PDF

### Stripe Webhooks
- MUST verify signature
- Handle idempotency
- Process asynchronously
- Update database atomically

### Blob Storage
- Use unique IDs for filenames
- Set appropriate expiry times
- Clean up failed uploads
- Handle concurrent access

### Security Considerations
- Validate file types server-side
- Limit file size (e.g., 10MB)
- Sanitize overlay data
- Rate limit upload endpoint
- Verify payment before generation
- Sign download URLs with expiry

---

## Testing Strategy

### Unit Tests
- Overlay serialization/deserialization
- PDF coordinate calculations
- Payment flow state machine

### Integration Tests
- Upload → Edit → Payment → Download flow
- Webhook handling
- File cleanup

### E2E Tests
- Complete user journey
- Payment success/failure scenarios
- Mobile device testing

---

## Performance Targets

- Initial page load: < 2s
- PDF upload: < 5s for 5MB file
- PDF rendering: < 1s per page
- Payment processing: < 3s
- PDF generation: < 5s
- Download initiation: < 1s

---

## Deployment Checklist

- [ ] Configure Vercel project
- [ ] Set up production Stripe account
- [ ] Configure webhook URL in Stripe dashboard
- [ ] Set all environment variables
- [ ] Test payment flow in production
- [ ] Set up cron job for cleanup
- [ ] Configure custom domain
- [ ] Enable error tracking (Sentry)
- [ ] Set up basic analytics

---

## Future Technical Enhancements

- WebAssembly PDF processing for performance
- Service worker for offline editing
- Progressive Web App capabilities
- CDN caching for static assets
- Database connection pooling optimization
- Batch PDF processing
- Real-time collaboration (WebSockets)
- Advanced PDF operations (merge, split, compress)
