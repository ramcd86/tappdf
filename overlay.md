# PDF Microtransaction Editor

## Technical Architecture & Core Project Concepts

---

## 1. Project Goal

Build a lightweight web application that allows users to:

- Upload existing PDFs **or** create new ones
- Perform simple editing operations
- Pay a small one-time fee (≈ €0.50–€0.99)
- Download the final processed PDF

The product is **not SaaS** and does **not require user accounts**.

The system prioritizes:

- Extremely fast time-to-value
- Zero onboarding friction
- Simple payment experience
- Temporary file storage
- Low operating cost

---

## 2. Core Principles

### 2.1 No Persistent Accounts

- Users are anonymous by default
- Each session is temporary
- Files expire automatically
- Optional email capture only after payment

---

### 2.2 Pay-on-Export Model

Users may:

- Upload and edit PDFs freely
- Only encounter payment when exporting

This maximizes conversion and minimizes abandonment.

---

### 2.3 Immutable PDF Strategy

Original PDFs are never edited in-place.

Instead:

```
Original PDF (read-only)
+ Overlay edit instructions (JSON)
= Newly generated PDF
```

This avoids corruption, simplifies undo/redo, and ensures consistency.

---

## 3. Technology Stack

### Frontend

- **Nuxt 3**
- **TypeScript**
- **PDF.js (pdfjs-dist)** – PDF rendering
- **Fabric.js** – editable overlay canvas
- **Stripe Payment Element** – payments

### Server

- **Nitro (Nuxt server engine)**
- Runs as serverless functions on Vercel

### Backend Libraries

- **pdf-lib** – PDF generation and modification
- **Stripe SDK** – payments & webhooks

### Hosting & Infrastructure

- **Vercel** – application hosting
- **Vercel Postgres** – minimal metadata storage
- **Vercel Blob Storage** – temporary file storage

---

## 4. High-Level Architecture

```
Browser (Nuxt)
│
├── PDF Viewer (PDF.js)
├── Edit Layer (Fabric.js)
├── Stripe Payment Modal
│
▼
Nitro API Routes
│
├── Upload handler
├── Payment intent creation
├── Webhook receiver
├── PDF generation
│
▼
Vercel Storage

- Original PDF
- Overlay JSON
- Final PDF (temporary)
```

---

## 5. Frontend Architecture

### 5.1 PDF Rendering

- PDF.js renders each page to a background canvas
- Canvas dimensions are locked to PDF page size

Each page contains:

- **Background canvas** – rendered PDF page
- **Overlay canvas** – editable objects

---

### 5.2 Editable Objects

Overlay objects stored as JSON:

- Text blocks
- Images
- Shapes
- Highlights
- Freehand drawings

Example:

```json
{
  "page": 1,
  "type": "text",
  "x": 120,
  "y": 340,
  "fontSize": 14,
  "value": "Invoice Paid"
}
```

Overlay data is saved periodically to prevent loss.

---

### 5.3 Client-Side Responsibilities

- Rendering
- Editing UX
- Undo/redo
- Zoom
- Page navigation
- Overlay serialization

The frontend **never generates the final PDF**.

---

## 6. Backend (Nitro) Responsibilities

### Nitro API routes handle:

- File uploads
- Temporary storage
- Stripe payment intent creation
- Payment verification via webhook
- Final PDF generation
- Signed download URL creation

The backend is stateless aside from storage.

---

## 7. File Lifecycle

### Upload

1. User uploads PDF
2. File stored in Vercel Blob
3. Metadata stored in Postgres
4. Expiry timestamp assigned

---

### Editing

- Original PDF remains unchanged
- Overlay JSON updated client-side
- Periodic autosave to backend

---

### Export

1. User clicks Download
2. Stripe PaymentIntent created
3. Payment modal opens
4. Stripe confirms payment
5. Webhook verifies payment
6. PDF generated using pdf-lib
7. File stored temporarily
8. Signed download link returned

---

### Cleanup

- Cron job deletes files after 1–24 hours
- Metadata cleaned automatically

---

## 8. Payment Architecture

### Stripe Payment Element

Supports automatically:

- Apple Pay
- Google Pay
- Credit/Debit cards
- Local payment methods

Single integration point.

---

### Payment Flow

```
User clicks Download
│
├── POST /api/payment/create-intent
│
├── Stripe Payment Element
│
├── Payment confirmation
│
├── Stripe webhook → /api/payment/webhook
│
└── PDF generation unlocked
```

---

### Security Rules

- Frontend payment confirmation is not trusted
- Only Stripe webhooks authorize exports
- Download URLs are signed and time-limited

---

## 9. Database Schema (Minimal)

### documents

| Field | Type |
|------|------|
| id | uuid |
| upload_path | text |
| overlay_path | text |
| final_path | text |
| payment_status | enum |
| expires_at | timestamp |

---

### payments

| Field | Type |
|------|------|
| id | uuid |
| stripe_intent_id | text |
| document_id | uuid |
| amount | integer |
| currency | text |
| status | text |

---

## 10. MVP Feature Scope

### Included

- Upload PDF
- View pages
- Add text
- Add images
- Move / resize objects
- Export after payment

---

### Deferred

- User accounts
- Collaboration
- Form field recognition
- OCR
- PDF text rewriting
- Subscription plans

---

## 11. Cost Considerations

- Vercel serverless execution: minimal
- Blob storage: temporary only
- Stripe fees: mitigated via €0.99 pricing or credit packs

Estimated cost per 1,000 documents is extremely low.

---

## 12. Future Extensions

- Credit bundles
- Saved document history
- Email delivery
- Branded exports
- Team access
- API access

---

## 13. Summary

This architecture:

- Avoids PDF complexity traps
- Scales naturally with demand
- Keeps infrastructure simple
- Supports microtransactions cleanly
- Allows rapid MVP development

The system is intentionally narrow, composable, and disposable — optimized for speed, clarity, and conversion.

---

**Primary objective:**

> Convert one-time document friction into instant paid resolution.

