# tapPDF - Implementation Overview
**Project:** PDF Editor with Pay-to-Download | **Framework:** Nuxt 3.21.0 | **Updated:** Jun 27, 2026

---

## QUICK START
```bash
cd c:/_dev/tapPDF && npm run dev  # http://localhost:3000
```

---

## CURRENT STATUS — Jun 27, 2026

**Phase 2 complete.** All core editor features, multi-page support, zoom, shapes, images, and visual polish are fully working in dev/mock mode.

### What Works
- ✅ Home page: create blank A4 PDF or upload existing PDF
- ✅ PDF rendering via PDF.js on canvas with working zoom (+/− controls in PageNavigator)
- ✅ Konva.js overlay canvas: text, rectangle, circle, ellipse, triangle, line, highlight — all with drag/resize/rotate
- ✅ Text formatting bar (header): bold, italic, underline, strikethrough, font family, size, colour
- ✅ Shape formatting bar (header): stroke colour, thickness slider, fill colour toggle — hidden for lines
- ✅ Page background colour picker (header, shown when no element is selected) — stored per page, rendered in PDF
- ✅ Select mode: clicking "Select" tool glows all selectable elements with blue highlight; clears on any click
- ✅ Deselect on click outside canvas (document-level mousedown listener)
- ✅ Image upload: PNG and JPG/JPEG only; file-type validation with error message
- ✅ Image overlays preserved across page switches (async load guarded by page-capture + suppressSave flag)
- ✅ Multi-page PDF: PageNavigator ← → buttons, page counter, per-page Konva canvas
- ✅ Add Page button: appends blank A4 to PDF via `POST /api/document/:id/add-page`
- ✅ Delete Page button: removes current page (page 1 protected); re-indexes all overlay objects; pink-red colour
- ✅ Page content correctly shifts up when a middle page is deleted (re-index fix + sentinel currentPage=-1)
- ✅ Zoom +/− re-renders PDF at new scale; OverlayCanvas stage.scale() matches for correct overlay positioning
- ✅ Overlay elements stay correctly positioned in PDF output at all zoom levels
- ✅ Stroke width preserved after resize (strokeScaleEnabled: false + scale baking in transformend)
- ✅ Shapes (rect/ellipse/line/triangle) use strokeScaleEnabled: false; scale baked into dimensions after transform
- ✅ Circle implemented as Konva.Ellipse (supports non-uniform scaling → becomes ellipse in PDF correctly)
- ✅ Triangle implemented as closed Konva.Line; PDF rendered via drawSvgPath with SVG origin at page top-left
- ✅ Line tool with hitStrokeWidth: 12 for easy selection; stroke min=1 in thickness slider
- ✅ All overlay types correctly positioned in PDF output (circle coordinate double-offset bug fixed)
- ✅ Overlay state serialized before payment via `POST /api/overlay/:id`
- ✅ Mock DB persists across Nitro hot-reloads (`.storage/mock-db.json`)
- ✅ PaymentModal: dark mode, `isMock` flag; dev mode shows "Simulate Payment & Download"
- ✅ Mock payment: saves overlays → `/api/generate` → bakes overlays into PDF → file download
- ✅ Real Stripe payment: payment intent → Stripe Elements → redirects to `/payment-success` → auto-download
- ✅ Concurrent PDF render protection: `_currentRenderTask.cancel()` before each new renderPage call
- ✅ Dark mode throughout (dark purple/gray palette, `bg-gray-950` body)
- ✅ Purple primary colour scheme (Tailwind primary palette = violet/purple)
- ✅ Pacifico font logo with purple-to-blue gradient and −20° rotation; hero size on landing page
- ✅ Solid borders removed from layout (header, sidebar, formatting bar, buttons, cards)
- ✅ Sidebar fixed/sticky (h-screen layout, overflow-hidden on flex row, aside has overflow-y-auto)
- ✅ Delete Page button styled pink-red (`text-pink-400 hover:bg-pink-900/20`)

---

## ARCHITECTURE

### Overlay System (`composables/useOverlay.ts`)
- **Module-level singletons**: `selectedFormattingState`, `selectedShapeFormattingState`, `currentPageBackgroundState` — reactive refs shared across components without prop drilling
- **`saveOverlays()`**: merges current page's canvas objects into `state.objects`; preserves other pages and background overlays; suppressed by `_loadingOverlays` flag during page reconstruction
- **`loadOverlaysForPage(pageNum, overlays)`**: async; uses `for...of` + `await addImage()` so all images are loaded before the single authoritative `saveOverlays()` call at the end
- **`switchPage(pageNum)`**: async; saves current page then awaits `loadOverlaysForPage`
- **`deletePageOverlays(pageIndex)`**: saves → filters out deleted page → re-indexes later pages → clears canvas → sets `state.currentPage = -1` (sentinel so next saveOverlays doesn't overwrite re-indexed data)
- **`setPageBackground(color)`**: draws a Konva Rect named `'page-background'` at z-bottom; stores as `type:'background'` overlay; updates `currentPageBackgroundState`
- **`setSelectMode(active)`**: casts `layer.find('.overlay-object')` to `Konva.Shape[]` for shadow properties; applies blue glow; clears on any canvas click via stage event
- **`_loadingOverlays` flag**: prevents intermediate `saveOverlays()` calls from overwriting state during page reconstruction
- **Image stale-load guard**: `pageAtCallTime = state.currentPage` captured at `addImage()` call; `onload` checks match before adding to canvas

### PDF (`composables/usePDF.ts`)
- **Module-level singleton**: `_state`, `_pdfDocument`, `_currentRenderTask` shared across components
- **Render cancellation**: `_currentRenderTask.cancel()` called before each new render to prevent "Cannot use same canvas during multiple render() operations" error
- **PDFViewer watches both `[currentPage, scale]` AND `loading`**: `loading→false` watcher handles the case where `loadPDF()` recreates the `<canvas>` DOM element (v-if/v-else toggle) without changing `currentPage`

### Page Switching in `editor.vue`
```
watch(pdf.state.currentPage) → overlayCanvas.switchPage(newPage - 1)
```
After delete: explicit `await nextTick(); overlayCanvas.switchPage(targetPage - 1)` handles the case where `currentPage` value doesn't change (watcher wouldn't fire).

### Overlay Types
| Type | Konva node | PDF rendering |
|------|-----------|---------------|
| `text` | `Konva.Text` | `drawText` + manual underline/strikethrough lines |
| `image` | `Konva.Image` | `embedPng`/`embedJpg` + `drawImage` |
| `shape: rectangle` | `Konva.Rect` | `drawRectangle` |
| `shape: circle` | `Konva.Ellipse` | `drawEllipse` (x/y = center) |
| `shape: line` | `Konva.Line` | `drawLine` with rotation matrix applied to endpoints |
| `shape: triangle` | `Konva.Line (closed)` | `drawSvgPath` with `x:0, y:pageHeight` (maps SVG→Konva coords) |
| `highlight` | `Konva.Rect` (rgba fill) | `drawRectangle` with opacity |
| `background` | Konva Rect (`page-background`) | `drawRectangle` full-page, rendered first (sorted by type) |

---

## FILE STATUS

```
pages/
  index.vue                   ✅ Complete — dark mode, hero logo, styled tagline
  editor.vue                  ✅ Complete — fixed sidebar, all formatting bars, page management
  payment-success.vue         ✅ Complete

components/
  UploadZone.vue              ✅ Complete — dark mode, PNG/JPG validation
  PDFViewer.vue               ✅ Complete — watches currentPage+scale+loading; emits {width,height,scale}
  OverlayCanvas.vue           ✅ Complete — exposes all overlay methods; accepts scale prop
  Toolbar.vue                 ✅ Complete — dark mode, no Actions section, shape type buttons
  PageNavigator.vue           ✅ Complete — wired to usePDF singleton; no borders
  PaymentModal.vue            ✅ Complete — dark mode

composables/
  useFileUpload.ts            ✅ Complete
  usePDF.ts                   ✅ Complete — singleton, zoom, render cancellation, loading watcher
  useOverlay.ts               ✅ Complete — per-page canvas, async image loading, background system
  usePayment.ts               ✅ Complete

server/api/
  upload.post.ts              ✅ Complete
  create-blank.post.ts        ✅ Complete
  generate.post.ts            ✅ Complete
  download/[id].get.ts        ✅ Complete
  document/[id].get.ts        ✅ Complete
  document/[id]/add-page.post.ts   ✅ Complete — appends blank A4 page
  document/[id]/delete-page.post.ts ✅ Complete — removes page by 0-based index
  storage/[filename].get.ts   ✅ Complete
  overlay/[id].post.ts        ✅ Complete
  payment/create-intent       ✅ Complete
  payment/webhook.post.ts     ⚠️ Webhook sig verification incomplete — Phase 3

server/
  db/client.ts                ✅ Complete (dual-mode, hot-reload safe)
  db/schema.ts                ⚠️ No Postgres auto-init — Phase 3
  utils/pdf-generator.ts      ✅ Complete — all shape types, background, SVG path triangles
  utils/storage.ts            ✅ Complete
  utils/stripe.ts             ✅ Complete

types/
  overlay.ts                  ✅ Complete — includes 'background' type
  document.ts                 ✅ Complete
  payment.ts                  ✅ Complete

assets/css/main.css           ✅ Complete — dark mode, logo-text / logo-text--hero classes

tailwind.config.js            ✅ Purple primary palette (violet scale 50→950)
nuxt.config.ts                ✅ Pacifico font via Google Fonts
```

---

## REMAINING WORK (Phase 3 — Production)

| Task | Priority | Notes |
|------|----------|-------|
| Stripe webhook sig verification | High | `stripe.webhooks.constructEvent()` in `payment/webhook.post.ts` |
| Vercel Blob + Postgres env | High | Dual-mode already coded; just needs env vars |
| Postgres auto-init on cold start | Medium | Nitro plugin: `CREATE TABLE IF NOT EXISTS ...` |
| Rate limiting | Medium | Nitro middleware; 10 uploads/IP/hour |
| Cleanup cron | Medium | `vercel.json` cron → `/api/cleanup`; delete docs > 24h |
| Document ownership token | Medium | Signed short-lived token on download URL |
| Content-Security-Policy header | Low | `nuxt.config.ts` |
| Undo / Redo | Low | History stack in useOverlay; Ctrl+Z/Y in keyboard handler |
| Toast notifications | Low | Replace silent `console.error` with user-visible toasts |
| Mobile layout | Low | Toolbar collapses to bottom bar < 768px |


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
