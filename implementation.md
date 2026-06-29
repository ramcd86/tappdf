# tapPDF - Implementation Overview

**Project:** PDF editor with pay-to-download model  
**Framework:** Nuxt 3.21.0  
**Updated:** Jun 29, 2026

## Quick Start

```bash
cd C:/_dev/tapPDF
npm install
npm run dev
```

Local development uses:

- local `.storage/` files instead of Vercel Blob when `BLOB_READ_WRITE_TOKEN` is absent
- `.storage/mock-db.json` instead of Postgres when `POSTGRES_URL` is absent
- mocked payments by default

If Nuxt generated files get stale locally:

```powershell
Remove-Item -Recurse -Force .nuxt,node_modules\.vite
npm.cmd run postinstall
npm.cmd run dev
```

## Current Status

The core editor and export loop are working:

1. create a blank A4 PDF
2. edit it in the browser with overlays
3. save overlays
4. simulate payment
5. generate and download a final PDF with overlays baked in

Production alpha currently uses real storage/database infrastructure, but payments remain mocked by default.

## Implemented Features

- Blank A4 PDF creation
- PDF rendering with PDF.js
- Konva overlay canvas
- Text overlays with formatting controls
- Image overlays
- Rectangle, circle/ellipse, line, and triangle shapes
- Page background color overlays
- Drag, resize, rotate, select, delete
- Layer ordering controls
- Multi-page navigation
- Add page
- Delete page, with page 1 protected in the UI
- Zoom-aware PDF rendering and overlay placement
- Overlay JSON persistence before export
- Server-side PDF generation with `pdf-lib`
- Mock payment and download flow
- Private Blob-backed file serving through app routes

## Important Current Defaults

### Payment Mock Mode

Payments are mocked by default on both client and server, including production.

Mock mode is active unless this is explicitly set:

```env
PAYMENT_MOCK_MODE=false
```

When mock mode is active:

- Stripe Elements are not mounted
- the modal shows "Simulate Payment & Download"
- `/api/payment/create-intent` is not required by the modal
- `/api/generate` allows PDF generation without a real paid Stripe status

### Private Blob Storage

Production Blob storage is private. The browser does not receive or load direct Vercel Blob URLs.

Current storage behavior:

- `uploadFile()` writes with `access: 'private'`
- DB records store Blob pathnames
- browser-facing URLs are `/api/storage/:filename`
- `/api/storage/:filename` streams the private Blob through Nitro
- app-served storage responses include no-cache headers

### Postgres

Production DB access uses the `postgres` package, not `@vercel/postgres`, so Supabase/Postgres-compatible URLs work.

When `POSTGRES_URL` is absent, the app uses the local mock DB persisted at:

```text
.storage/mock-db.json
```

Schema initialization is guarded and runs before production DB queries.

## Architecture

### Frontend

- `pages/index.vue`: create/start entry point
- `pages/editor.vue`: main editor workflow and page mutation handlers
- `components/PDFViewer.vue`: PDF.js canvas rendering
- `components/OverlayCanvas.vue`: Konva stage/layer/transformer integration
- `components/EditorHeader.vue`: document/page/formatting controls
- `components/Toolbar.vue`: tool selection
- `components/PaymentModal.vue`: mock/Stripe payment modal

### Composables

- `usePDF.ts`: PDF.js singleton, render cancellation, zoom/page state
- `useOverlay.ts`: Konva overlay state, serialization, page switching, formatting state
- `usePayment.ts`: payment coordination; respects public mock mode
- `useFileUpload.ts`: upload helper

### Server

- `server/api/create-blank.post.ts`: creates a blank PDF and document record
- `server/api/document/[id].get.ts`: returns document metadata with app storage URLs
- `server/api/document/[id]/add-page.post.ts`: appends a page and writes a fresh source PDF Blob
- `server/api/document/[id]/delete-page.post.ts`: removes a page and writes a fresh source PDF Blob
- `server/api/overlay/[id].post.ts`: saves overlay JSON
- `server/api/generate.post.ts`: bakes overlays into final PDF
- `server/api/download/[id].get.ts`: downloads generated PDF
- `server/api/storage/[filename].get.ts`: streams local files or private Blob files
- `server/api/payment/create-intent.post.ts`: creates payment metadata when real payment flow is used
- `server/api/payment/webhook.post.ts`: webhook handler, still production-hardening work

### Utilities

- `server/utils/storage.ts`: local/private Blob dual-mode storage
- `server/utils/pdf-generator.ts`: overlay-to-PDF rendering
- `server/utils/stripe.ts`: Stripe SDK or mock client
- `server/db/sql.ts`: shared Postgres client
- `server/db/client.ts`: DB operations and local mock DB
- `server/db/schema.ts`: schema initialization

## Overlay Model

The editor stores user edits as `OverlayObject[]`.

| Overlay | Browser node | PDF output |
| --- | --- | --- |
| text | `Konva.Text` | `drawText`, with underline/strikethrough lines |
| image | `Konva.Image` | `embedPng`/`embedJpg` + `drawImage` |
| rectangle | `Konva.Rect` | `drawRectangle` |
| circle/ellipse | `Konva.Ellipse` | `drawEllipse` |
| line | `Konva.Line` | `drawLine` |
| triangle | closed `Konva.Line` | `drawSvgPath` |
| background | non-listening `Konva.Rect` | full-page `drawRectangle` first |

Coordinate notes:

- PDF.js/Konva use top-left orientation in the browser.
- `pdf-lib` uses bottom-left PDF coordinates.
- Shape and text conversion lives in `server/utils/pdf-generator.ts`.
- Circle/ellipse `x`/`y` is treated as center coordinates.
- Triangle export uses SVG path mapping with `x: 0, y: pageHeight`.

## Page Mutation Fix

Production add/delete page was flaky when the app overwrote the same Blob pathname and immediately reloaded the PDF.

Current behavior avoids that:

1. server reads current source PDF
2. server mutates pages with `pdf-lib`
3. server writes a new source PDF Blob pathname
4. `documents.upload_path` is updated
5. API returns the new `uploadUrl`
6. editor reloads PDF.js from that returned URL
7. add/delete buttons are disabled while either mutation is in progress

This prevents stale Blob/CDN/PDF.js bytes from being reused after a same-path overwrite.

## Local Dev Fix

Nuxt dev had a generated-alias issue around `#app-manifest`. The repo now includes:

- `app-manifest-shim.ts`
- a Vite alias in `nuxt.config.ts`

This keeps local dev startup stable after `.nuxt` regeneration.

## File Status

```text
pages/
  index.vue                         working
  editor.vue                        working
  payment-success.vue               present for later real Stripe flow

components/
  EditorHeader.vue                  working
  OverlayCanvas.vue                 working
  PDFViewer.vue                     working
  PageNavigator.vue                 working
  PaymentModal.vue                  mock mode default
  Toolbar.vue                       working
  UploadZone.vue                    implemented but homepage upload currently hidden

composables/
  usePDF.ts                         working
  useOverlay.ts                     working
  usePayment.ts                     mock-aware
  useFileUpload.ts                  working

server/api/
  create-blank.post.ts              working
  document/[id].get.ts              working
  document/[id]/add-page.post.ts    working, immutable Blob path
  document/[id]/delete-page.post.ts working, immutable Blob path
  storage/[filename].get.ts         working for local and private Blob
  overlay/[id].post.ts              working
  generate.post.ts                  working
  download/[id].get.ts              working
  upload.post.ts                    implemented, homepage upload currently hidden
  payment/create-intent.post.ts     present
  payment/webhook.post.ts           needs real-payment hardening

server/
  db/sql.ts                         production Postgres client
  db/client.ts                      mock/prod DB operations
  db/schema.ts                      guarded schema init
  utils/storage.ts                  local/private Blob storage
  utils/pdf-generator.ts            final PDF rendering
  utils/stripe.ts                   mock default
```

## Production Environment

Required for current production alpha:

```env
BLOB_READ_WRITE_TOKEN=
POSTGRES_URL=
BASE_URL=
```

Optional/currently defaulted:

```env
PAYMENT_MOCK_MODE=true
PAYMENT_AMOUNT=99
PAYMENT_CURRENCY=eur
FILE_EXPIRY_HOURS=24
```

Real Stripe later:

```env
PAYMENT_MOCK_MODE=false
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

## Remaining Work

| Task | Priority | Notes |
| --- | --- | --- |
| Real Stripe activation | High | Flip `PAYMENT_MOCK_MODE=false` and verify full flow |
| Stripe webhook hardening | High | Ensure webhook signature/authorization is production-grade |
| Download ownership token | Medium | Prevent arbitrary document id download attempts |
| Cleanup cron | Medium | Delete expired documents and orphaned Blob files |
| Rate limiting | Medium | Upload/generate abuse protection |
| Toast notifications | Low | Replace silent console failures with user-visible errors |
| Undo/redo | Low | History stack in `useOverlay` |
| Mobile layout | Low | Toolbar/editor responsive pass |

## Verification Commands

```bash
npm.cmd run typecheck
npm.cmd run build
```
