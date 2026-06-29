# tapPDF Architecture Notes

## Current Product Goal

tapPDF is a lightweight PDF editor built around a simple promise:

- create or upload a PDF
- make quick edits in the browser
- pay once at export time
- download the processed PDF

The product is not a SaaS workspace. There are no accounts, no subscriptions, and no persistent document library. Files are temporary and document records expire.

The current alpha keeps payments mocked in production while the editor, storage, database, and PDF generation paths run against real infrastructure.

## Core Principles

### No Accounts

Users are anonymous by default. A document is identified by an opaque document id, and all files are temporary.

### Pay On Export

Editing is free. Payment is only encountered when the user chooses to download the final PDF.

During the alpha, payment is mocked by default on both server and client. Real Stripe is enabled later by setting:

```env
PAYMENT_MOCK_MODE=false
```

### Immutable Overlay Strategy

The app does not rewrite PDF internals in the browser. The editing model is:

```text
Source PDF
+ Overlay JSON
= Generated final PDF
```

The browser owns rendering and editing UX. The server owns final PDF generation.

### Immutable Page Mutation

Page add/delete operations now also avoid overwriting the same Blob object. Each page-structure mutation writes a new source PDF pathname and updates `documents.upload_path`.

This prevents production flakiness caused by Vercel Blob/CDN/PDF.js serving stale bytes after same-path overwrites.

## Tech Stack

### Frontend

- Nuxt 3
- Vue 3
- TypeScript
- Tailwind CSS
- PDF.js (`pdfjs-dist`) for page rendering
- Konva.js for editable overlay canvas
- Stripe Payment Element support, currently bypassed by mock mode

`fabric` remains in dependencies as legacy baggage but should not be used for new work.

### Server

- Nitro API routes
- `pdf-lib` for PDF creation and export
- Vercel Blob for temporary file storage
- Postgres metadata storage via the `postgres` package
- Stripe SDK with mock mode default

### Hosting

- Vercel app hosting
- Vercel Blob, configured as private storage
- Supabase/Postgres-compatible `POSTGRES_URL`

## High-Level Flow

```text
Browser
  PDF.js background canvas
  Konva overlay canvas
  Editor controls
  Mock/Stripe payment modal

Nitro API
  create blank PDF
  upload PDF
  save overlay JSON
  add/delete pages
  generate final PDF
  serve private Blob files through /api/storage

Storage/DB
  private Blob files
  document metadata
  payment metadata
```

## File Storage

Production Blob storage is private. The browser does not load Vercel Blob URLs directly.

Instead:

- files are uploaded to private Vercel Blob with `access: 'private'`
- DB records store Blob pathnames
- browser-facing URLs use `/api/storage/:filename`
- `/api/storage/:filename` streams private Blob contents through Nitro
- storage responses use `Cache-Control: no-store`

This is especially important for PDF.js, which can otherwise cache or reuse stale document bytes.

## Document Lifecycle

### Create Blank

1. Server creates an A4 PDF with `pdf-lib`.
2. PDF is uploaded to private Blob.
3. Document metadata is inserted into Postgres.
4. Browser receives a document id and app storage URL.

### Edit

1. PDF.js renders the current source PDF.
2. Konva renders overlays on top.
3. Overlays are serialized as JSON.
4. Multi-page overlay state is stored per page index.

Implemented editor capabilities include:

- text overlays
- image overlays
- rectangle, circle/ellipse, line, and triangle shapes
- page backgrounds
- selection, drag, resize, rotate
- layer ordering controls
- multi-page navigation
- add/delete page
- zoom-aware rendering/export

### Add/Delete Page

1. Server reads the current source PDF from Blob.
2. `pdf-lib` adds or removes the requested page.
3. Server writes a new source PDF Blob pathname.
4. `documents.upload_path` is updated.
5. API returns the new `uploadUrl` and page count.
6. Client reloads PDF.js from that exact returned URL.

The UI disables both page mutation buttons while either add or delete is in progress.

### Export

1. Current overlays are saved to `/api/overlay/:id`.
2. In mock mode, modal shows "Simulate Payment & Download".
3. `/api/generate` reads the source PDF and overlay JSON.
4. Server bakes overlays into a final PDF with `pdf-lib`.
5. Final PDF is uploaded to private Blob.
6. Download uses app-routed storage/download endpoints.

## Payment Mode

Payments are mocked by default, including production alpha.

Mock mode is active unless:

```env
PAYMENT_MOCK_MODE=false
```

When mock mode is active:

- the client does not mount Stripe Elements
- the modal does not call `/api/payment/create-intent`
- `/api/generate` allows export without a real paid Stripe status

When real payments are enabled later, the intended production rule remains:

- frontend payment success is not trusted
- Stripe webhook success authorizes export
- generated downloads should be time-limited and ownership-protected

## Database

The app uses a minimal metadata schema.

### documents

| Field | Purpose |
| --- | --- |
| id | opaque document id |
| upload_path | current source PDF Blob pathname |
| overlay_path | overlay JSON Blob pathname |
| final_path | generated final PDF Blob pathname |
| payment_status | pending, paid, failed |
| created_at | creation timestamp |
| expires_at | expiry timestamp |

### payments

| Field | Purpose |
| --- | --- |
| id | payment row id |
| stripe_intent_id | Stripe or mock intent id |
| document_id | associated document |
| amount | amount in cents |
| currency | payment currency |
| status | payment status |
| created_at | creation timestamp |

Production DB access now uses the generic `postgres` client so Supabase/Postgres-compatible URLs work. Local development still falls back to `.storage/mock-db.json` when `POSTGRES_URL` is absent.

## Current Hardening Completed

- Upgraded `@vercel/blob` for private Blob support.
- Switched production Blob writes to `access: 'private'`.
- Routed browser file access through `/api/storage`.
- Normalized DB storage to use pathnames instead of public URLs.
- Added no-cache headers for app-served storage files.
- Added `postgres` DB client for Supabase-compatible production URLs.
- Added guarded one-time schema initialization before production DB queries.
- Made payment mock mode the default on server and client.
- Prevented Stripe Elements from mounting during mock mode.
- Made add/delete page write new source PDFs instead of overwriting Blob paths.
- Updated editor reload logic to use returned source PDF URLs.
- Added local Nuxt dev shim for `#app-manifest` resolution.

## Deferred Work

- Real Stripe activation and webhook hardening.
- Signed or ownership-protected download URLs.
- Cleanup cron for expired documents and orphaned Blob files.
- Rate limiting uploads and generation.
- Undo/redo.
- Toast/error UI instead of console-only failures.
- Mobile editor layout.

## Summary

tapPDF is optimized for fast, one-off PDF editing. The architecture intentionally avoids deep PDF editing complexity by treating edits as overlay instructions and generating a fresh final PDF server-side.

Primary objective:

> Convert one-time document friction into instant paid resolution.
