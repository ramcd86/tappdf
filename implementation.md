# tapPDF - Implementation Plan
**Project:** PDF Editor with Pay-to-Download | **Framework:** Nuxt 3.21.0

---

## QUICK START
```bash
cd c:/_dev/tapPDF && npm run dev  # http://localhost:3000
```

---

## CURRENT STATUS — Jun 26, 2026

**Phase 1 complete.** Full end-to-end flow is working in dev/mock mode:
create PDF → add text/shapes/highlights → save → simulate payment → download PDF with overlays embedded.

### What Works
- ✅ Home page: create blank A4 PDF or upload existing PDF
- ✅ PDF rendering via PDF.js on canvas
- ✅ Konva.js overlay canvas: text, rectangle, circle, highlight — all with drag/resize/rotate handles
- ✅ Text formatting toolbar: bold, italic, underline, strikethrough, font family, size, colour
- ✅ Overlay state synced on every add/modify; serialized before payment via `POST /api/overlay/:id`
- ✅ Mock DB persists across Nitro hot-reloads (`.storage/mock-db.json`)
- ✅ PaymentModal: server signals `isMock` flag; dev mode shows "Simulate Payment & Download"
- ✅ Mock payment: saves overlays → `/api/generate` → bakes overlays into PDF → file download
- ✅ Real Stripe payment: payment intent → Stripe Elements → redirects to `/payment-success` → auto-download
- ✅ Text overlays appear in downloaded PDF (Helvetica/Bold/Italic/BoldItalic via pdf-lib StandardFonts)
- ✅ Rectangle and circle shape overlays appear in downloaded PDF
- ✅ Highlight overlays appear in downloaded PDF
- ✅ Local filesystem storage (dev) / Vercel Blob (prod) dual-mode
- ✅ In-memory + file-persisted DB (dev) / Vercel Postgres (prod) dual-mode

### Known Issues (to fix in Phase 2)
- ⚠️ Circle overlay x/y in PDF is offset — Konva Circle x/y is already the centre; pdf-generator adds `width/2` again
- ⚠️ Text Y position uses `fontSize` as height offset; true position depends on font descenders
- ⚠️ Custom fonts not supported (pdf-lib only has Helvetica, Times, Courier StandardFonts)
- ⚠️ Image overlay button exists in toolbar but has no upload mechanism
- ⚠️ Zoom +/- buttons update UI counter only; do not re-render canvas or resize Konva stage
- ⚠️ PageNavigator is UI-only; page switching does not change the Konva overlay layer
- ⚠️ No undo/redo

---

## PHASE 2 — Robustness

### 2.1 Circle Overlay Coordinate Fix *(15 min)*
**File:** `server/utils/pdf-generator.ts`

Konva.Circle stores x/y at the centre. `applyShapeOverlay` currently adds `width/2` to x, doubling the offset.

```typescript
// Fix in applyShapeOverlay for shapeType === 'circle':
page.drawEllipse({
  x: x,              // already the centre — remove + width / 2
  y: pdfY + height / 2,
  xScale: width / 2,
  yScale: height / 2,
  ...
})
```

### 2.2 Image Overlay Upload Flow *(60 min)*
**New file:** `server/api/image-upload.post.ts`  
**Modify:** `components/Toolbar.vue`, `composables/useOverlay.ts`

1. "Add Image" button triggers `<input type="file" accept="image/*">` (hidden)
2. On select: POST image to `/api/image-upload` → store in `.storage/` → return URL
3. Call `overlay.addImage(url)` — already implemented, just needs the URL
4. `applyImageOverlay` in pdf-generator.ts fetches the URL and embeds JPEG/PNG

### 2.3 Zoom / Scale Support *(45 min)*
**Files:** `pages/editor.vue`, `composables/usePDF.ts`, `components/OverlayCanvas.vue`

1. `usePDF.zoomIn()` / `zoomOut()` already update `state.scale`; also re-render the PDF canvas
2. `PDFViewer` must emit new dimensions on scale change; `OverlayCanvas` resizes its Konva stage
3. Overlay objects need `canvasScale` metadata so pdf-generator can invert the scale when baking

### 2.4 Multi-Page PDF Support *(90 min)*
**Files:** `components/PageNavigator.vue`, `composables/useOverlay.ts`

- `PageNavigator` calls `overlay.setPage(n)` on prev/next click
- `setPage(n)` serializes current-page overlays, clears stage, loads overlays for new page
- All overlay objects already carry `page: number`; pdf-generator already groups by page — backend is ready

### 2.5 Undo / Redo *(60 min)*
**File:** `composables/useOverlay.ts`

```typescript
const history: string[] = []
const historyIndex = ref(-1)

// After every saveOverlays():
history.splice(historyIndex.value + 1)  // discard redo stack
history.push(JSON.stringify(state.objects))
historyIndex.value = history.length - 1

function undo() { /* load history[--historyIndex] */ }
function redo() { /* load history[++historyIndex] */ }
```
Wire Ctrl+Z / Ctrl+Y in the existing keyboard handler. Limit stack to 20 entries.

### 2.6 Toast Notifications *(30 min)*
**New:** `composables/useToast.ts`, toast component in `app.vue`

Replace silent `console.error` failures with user-visible toasts:
- Upload failure, generate failure, network errors
- "PDF downloaded successfully" on completion

### 2.7 Mobile Layout *(45 min)*
- Toolbar collapses to a bottom bar on screens < 768px
- Konva stage supports pinch-to-zoom via native pointer events

---

## PHASE 3 — Production

### 3.1 Real Stripe Setup
```
STRIPE_SECRET_KEY=sk_live_...
NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```
The `isMock` flag deactivates automatically when a real key is present. No code changes needed.

### 3.2 Vercel Blob + Postgres
```
BLOB_READ_WRITE_TOKEN=vercel_blob_...
POSTGRES_URL=postgresql://...
```
Both are already dual-mode. Add a Nitro plugin that runs `CREATE TABLE IF NOT EXISTS documents (...)` on first cold start.

### 3.3 Rate Limiting
- Nitro middleware: 10 uploads/IP/hour, 5 payment attempts/IP/hour
- Use `x-forwarded-for` header (set by Vercel)

### 3.4 Cleanup Cron
```json
// vercel.json
{ "crons": [{ "path": "/api/cleanup", "schedule": "0 * * * *" }] }
```
New endpoint deletes documents + files older than 24 hours.

### 3.5 Security Hardening
- Complete Stripe webhook signature verification in `payment/webhook.post.ts` (`stripe.webhooks.constructEvent()`)
- Document ownership check on `/api/download/:id` — add signed token or short-lived session
- `Content-Security-Policy` header in `nuxt.config.ts`
- Sanitize user text before embedding in PDF (strip control characters)

---

## FILE STATUS

```
pages/
  index.vue                   ✅ Complete
  editor.vue                  ✅ Complete
  payment-success.vue         ✅ Complete

components/
  UploadZone.vue              ✅ Complete
  PDFViewer.vue               ✅ Complete
  OverlayCanvas.vue           ✅ Complete
  Toolbar.vue                 ✅ Complete (image upload not wired — Phase 2.2)
  PageNavigator.vue           ⚠️ UI only, overlay not wired — Phase 2.4
  PaymentModal.vue            ✅ Complete (mock + real Stripe)

composables/
  useFileUpload.ts            ✅ Complete
  usePDF.ts                   ✅ Complete (zoom re-render not wired — Phase 2.3)
  useOverlay.ts               ✅ Complete (no undo/redo — Phase 2.5)
  usePayment.ts               ✅ Complete

server/api/
  upload.post.ts              ✅ Complete
  create-blank.post.ts        ✅ Complete
  generate.post.ts            ✅ Complete
  download/[id].get.ts        ✅ Complete
  document/[id].get.ts        ✅ Complete
  storage/[filename].get.ts   ✅ Complete
  overlay/[id].post.ts        ✅ Complete
  payment/create-intent       ✅ Complete
  payment/webhook.post.ts     ⚠️ Webhook sig verification incomplete — Phase 3.5
  image-upload.post.ts        ❌ Does not exist — Phase 2.2

server/
  db/client.ts                ✅ Complete (dual-mode, hot-reload safe)
  db/schema.ts                ⚠️ No Postgres auto-init — Phase 3.2
  utils/pdf-generator.ts      ✅ Functional (circle coord bug — Phase 2.1)
  utils/storage.ts            ✅ Complete
  utils/stripe.ts             ✅ Complete

types/
  overlay.ts                  ✅ Complete
  document.ts                 ✅ Complete
  payment.ts                  ✅ Complete
```

---

## TECHNICAL DEBT

| Issue | Severity | File | Fix |
|-------|----------|------|-----|
| Circle x/y double-offset in generated PDF | High | pdf-generator.ts | Remove `+ width/2` for circle x |
| Text Y offset uses fontSize not line height | Medium | pdf-generator.ts | Use `font.heightAtSize(size)` |
| Zoom controls cosmetic only | Medium | editor.vue, usePDF | Re-render + resize Konva on scale change |
| PageNavigator not wired to overlays | Medium | PageNavigator.vue | Call `overlay.setPage()` |
| `fabric` still in package.json | Low | package.json | `npm uninstall fabric` |
| `any` types in useOverlay / editor.vue | Low | Multiple | Add proper Konva node type wrappers |
| Text state polling via setInterval 300ms | Low | editor.vue | Replace with Konva event → defineExpose |
| Stripe webhook signature not verified | Medium | payment/webhook.post.ts | Complete `constructEvent()` call |
