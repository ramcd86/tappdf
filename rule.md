# tapPDF — LLM Rules & Project Context

> This file is the authoritative reference for any LLM assistant (e.g. qwen2.5-coder via Continue) working on this codebase.
> Read this entire file before generating, editing, or reviewing any code.

---

## 1. Project Overview

**tapPDF** is a lightweight, pay-to-download PDF editor.

- Users upload or create a blank PDF, annotate/edit it on a canvas, pay a one-time fee (€0.99), and download.
- **No user accounts. No subscriptions. Files expire after 24 hours.**
- Immutable PDF strategy: the original PDF is never edited — overlays are stored as JSON and baked in at export time.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Nuxt 3.21.0 (Vue 3 + Nitro) | Server = Nitro (serverless on Vercel) |
| Canvas editor | Konva.js 10.x + vue-konva 3.x | Fabric.js is in `package.json` but unused — do NOT use it |
| PDF rendering | pdfjs-dist 4.x | PDF.js worker at `/public/pdf.worker.min.mjs` |
| PDF generation | pdf-lib 1.x | Server-side only; bakes overlays into final PDF |
| Payments | Stripe (stripe-js 4.x + stripe 16.x) | Payment Elements; mock mode in dev |
| Storage | Vercel Blob (prod) / local `.storage/` (dev) | Dual-mode; auto-selected by env vars |
| Database | Vercel Postgres + Drizzle ORM (prod) / in-memory + `.storage/mock-db.json` (dev) | Dual-mode |
| Styling | Tailwind CSS | Dark mode throughout; purple primary palette |
| Language | TypeScript (strict mode) | All files `.ts` or `.vue` with `<script setup lang="ts">` |
| Deployment | Vercel | Nitro preset: `vercel` |

---

## 3. Repository Structure

```
tapPDF/
├── pages/
│   ├── index.vue             # Landing page — upload or create blank PDF
│   ├── editor.vue            # Main editor — canvas, toolbar, page nav, payment trigger
│   └── payment-success.vue   # Post-Stripe redirect; auto-download
├── components/
│   ├── UploadZone.vue        # Drag-and-drop / file input; PNG/JPG validation
│   ├── PDFViewer.vue         # Renders PDF.js canvas; emits {width, height, scale}
│   ├── OverlayCanvas.vue     # Konva.js stage; exposes all overlay methods via defineExpose
│   ├── Toolbar.vue           # Tool selector; shape type buttons; no Actions section
│   ├── PageNavigator.vue     # Prev/next page buttons + page counter; wired to usePDF singleton
│   └── PaymentModal.vue      # Stripe Payment Elements modal; mock mode support
├── composables/
│   ├── usePDF.ts             # PDF.js singleton; zoom; render cancellation
│   ├── useOverlay.ts         # Konva overlay state; per-page canvas; async image loading
│   ├── useFileUpload.ts      # File upload helper
│   └── usePayment.ts         # Stripe payment intent + confirmation
├── server/
│   ├── api/
│   │   ├── upload.post.ts
│   │   ├── create-blank.post.ts
│   │   ├── generate.post.ts          # Bakes overlays into PDF; returns download
│   │   ├── overlay/[id].post.ts      # Saves overlay JSON for a document
│   │   ├── document/[id].get.ts
│   │   ├── document/[id]/add-page.post.ts
│   │   ├── document/[id]/delete-page.post.ts
│   │   ├── download/[id].get.ts
│   │   ├── storage/[filename].get.ts
│   │   └── payment/
│   │       ├── create-intent.post.ts
│   │       └── webhook.post.ts       # ⚠️ Stripe sig verification incomplete (Phase 3)
│   ├── db/
│   │   ├── client.ts                 # All DB operations; dual-mode (mock + Postgres)
│   │   └── schema.ts                 # Table definitions + initializeSchema()
│   └── utils/
│       ├── pdf-generator.ts          # pdf-lib logic; renders all overlay types to PDF
│       ├── storage.ts                # Blob/local file read/write helpers
│       └── stripe.ts                 # Stripe SDK initialisation
├── types/
│   ├── overlay.ts                    # OverlayObject, TextOverlay, ShapeOverlay, etc.
│   ├── document.ts                   # Document, CreateDocumentInput, UpdateDocumentInput
│   └── payment.ts                    # Payment, CreatePaymentIntentInput, etc.
├── assets/css/main.css               # Global styles; logo-text / logo-text--hero classes
├── tailwind.config.js                # Purple primary palette (violet scale)
├── nuxt.config.ts                    # Runtime config; Nitro preset; Vite chunk split
└── .storage/                         # Dev-only; mock-db.json + uploaded files (gitignored)
```

---

## 4. Core Architectural Rules

### 4.1 Composable Singletons
- `usePDF` and `useOverlay` use **module-level singletons** (`_state`, `_pdfDocument`, etc. declared outside the function).
- This means all components share the same state. **Do not create new reactive state inside the function body** for anything that must persist across component mounts.
- The three formatting refs exported from `useOverlay.ts` are also module-level singletons:
  - `selectedFormattingState` — text formatting bar state
  - `selectedShapeFormattingState` — shape formatting bar state
  - `currentPageBackgroundState` — page background colour

### 4.2 Immutable PDF Strategy
- The original uploaded PDF is **never modified**.
- All edits are stored as `OverlayObject[]` JSON.
- `POST /api/generate` (server-side) reads the original PDF + overlay JSON and uses `pdf-lib` to produce a new file.
- **Never attempt client-side PDF generation.**

### 4.3 Dual-Mode (Dev vs Prod)
- All storage and DB code checks env vars and falls back to local mode automatically.
- `IS_MOCK_DB = !process.env.POSTGRES_URL` — no env var = mock DB.
- Mock DB persists to `.storage/mock-db.json` so it survives Nitro hot-reloads.
- Stripe uses `isMock = !process.env.STRIPE_SECRET_KEY` — no key = simulate payment.
- **Do not add code paths that only work in one mode** unless the dual-mode switch is already present.

### 4.4 Konva vs Fabric
- The canvas editor uses **Konva.js** exclusively. `fabric` is still listed in `package.json` but is unused legacy — do not import or use it.
- Konva nodes must **not** be made reactive (Vue proxy wrapping breaks Konva internals). Store stage/layer/transformer in plain `let` variables.

### 4.5 Overlay `_loadingOverlays` Flag
- `saveOverlays()` is suppressed while `loadOverlaysForPage()` reconstructs the canvas (the `_loadingOverlays` flag).
- Never call `saveOverlays()` directly from inside a load/reconstruct flow — it will overwrite state incorrectly.

### 4.6 Page Indexing
- `usePDF.state.currentPage` is **1-based** (matches PDF.js convention).
- Konva overlay arrays and `switchPage()` use **0-based** page indices.
- `editor.vue` bridges this: `watch(pdf.state.currentPage) → overlayCanvas.switchPage(newPage - 1)`.

### 4.7 Render Cancellation
- `_currentRenderTask.cancel()` is called before every new `renderPage()` call to prevent the PDF.js "Cannot use same canvas during multiple render() operations" error.
- `RenderingCancelledException` is **expected and silently ignored** in the catch block.

---

## 5. TypeScript Rules

- Strict mode is enabled (`"strict": true` in `nuxt.config.ts`).
- All new files must be fully typed — no implicit `any`.
- Existing `any` in the codebase (`OverlayObject.data`, webhook handler, etc.) is acknowledged technical debt — do not introduce new `any` types.
- Use types from `~/types/overlay.ts`, `~/types/document.ts`, `~/types/payment.ts` rather than redefining them inline.
- Vue SFCs use `<script setup lang="ts">`.
- Composables return typed objects (not `any`).

---

## 6. Overlay Type System

Every overlay object on the canvas is serialised to an `OverlayObject`:

```typescript
interface OverlayObject {
  id: string
  page: number        // 0-based page index
  type: 'text' | 'image' | 'shape' | 'highlight' | 'drawing' | 'background'
  x: number
  y: number
  width?: number
  height?: number
  rotation?: number
  data: Record<string, any>   // type-specific payload
}
```

| Type | Konva node | `data` fields | PDF rendering |
|---|---|---|---|
| `text` | `Konva.Text` | text, fontSize, fontFamily, color, fontWeight, fontStyle, textDecoration, align | `drawText` + manual underline/strikethrough lines |
| `image` | `Konva.Image` | src, opacity | `embedPng`/`embedJpg` + `drawImage` |
| `shape: rectangle` | `Konva.Rect` | shape, fill, stroke, strokeWidth | `drawRectangle` |
| `shape: circle` | `Konva.Ellipse` | shape, fill, stroke, strokeWidth | `drawEllipse` (x/y = centre) |
| `shape: line` | `Konva.Line` | shape, stroke, strokeWidth | `drawLine` with rotation matrix |
| `shape: triangle` | `Konva.Line (closed)` | shape, fill, stroke, strokeWidth | `drawSvgPath` with `x:0, y:pageHeight` |
| `highlight` | `Konva.Rect` (rgba fill) | color, opacity | `drawRectangle` with opacity |
| `background` | `Konva.Rect` (`name: 'page-background'`) | color | `drawRectangle` full-page; rendered first |

**Important coordinate rules:**
- `shape: circle` — `x`/`y` is the **centre** (Konva.Ellipse convention). Do NOT add `width/2` in `pdf-generator.ts`.
- `shape: triangle` — SVG path origin is at `x:0, y:pageHeight` to map SVG top-left to PDF bottom-left.
- All overlay coordinates are in **canvas pixels at the scale the overlay was created**. `pdf-generator.ts` must account for `canvasScale` when baking.

---

## 7. Styling Rules

- **Dark mode only** — body background is `bg-gray-950`. All UI uses dark grey/purple palette.
- **Primary colour = purple/violet** — use `primary-*` Tailwind tokens (mapped to violet scale in `tailwind.config.js`).
- **No solid borders** — layout sections (header, sidebar, cards) use shadow or subtle background contrast instead of `border-*` classes.
- Sidebar is `h-screen` with `overflow-y-auto`; the outer flex row uses `overflow-hidden` to keep the sidebar fixed.
- Logo: Pacifico font, `logo-text` CSS class, purple-to-blue gradient, −20° rotation.
- Delete Page button: `text-pink-400 hover:bg-pink-900/20` (distinguished danger colour).
- Select mode active glow: blue highlight on overlay elements (`Konva.Shape` shadow via `shadowColor`/`shadowBlur`).

---

## 8. API Route Conventions (Nitro)

- File naming: `[method].ts` suffix (e.g. `upload.post.ts`, `document/[id].get.ts`).
- Dynamic segments: `[id]` in the filename — accessed via `event.context.params.id`.
- All routes use `defineEventHandler(async (event) => { ... })`.
- Return plain objects — Nitro serialises to JSON automatically.
- Throw errors with `createError({ statusCode, statusMessage })`.
- Server-only imports (node builtins, Stripe SDK, pdf-lib) are safe here — they never run on the client.

---

## 9. Database Rules

- Use functions from `server/db/client.ts` exclusively — never call `sql` directly from API routes.
- The client module exports: `createDocument`, `getDocument`, `updateDocumentOverlay`, `updateDocumentFinal`, `deleteExpiredDocuments`, `createPayment`, `getPaymentByIntent`, `updatePaymentStatus`.
- DB columns use `snake_case`; TypeScript interfaces mirror this (`upload_path`, `payment_status`, etc.).
- `payment_status` enum: `'pending' | 'paid' | 'failed'`.
- IDs are `nanoid()` strings in mock mode and UUIDs in Postgres mode — treat them as opaque strings.

---

## 10. Environment Variables

| Variable | Side | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | Server | Real Stripe; absence = mock mode |
| `STRIPE_WEBHOOK_SECRET` | Server | Webhook signature verification |
| `BLOB_READ_WRITE_TOKEN` | Server | Vercel Blob; absence = local `.storage/` |
| `POSTGRES_URL` | Server | Vercel Postgres; absence = mock DB |
| `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_PUBLISHABLE_KEY` | Public | Stripe client key |
| `BASE_URL` | Public | Default: `http://localhost:3000` |
| `PAYMENT_AMOUNT` | Public | Default: `99` (cents = €0.99) |
| `PAYMENT_CURRENCY` | Public | Default: `eur` |
| `FILE_EXPIRY_HOURS` | Public | Default: `24` |

No env vars are required for local development — everything runs in mock mode.

---

## 11. Known Issues & Technical Debt

These exist in the current codebase. Do not accidentally "fix" them in unrelated changes, but if your task touches these files, apply the fix described:

| Issue | File | Fix |
|---|---|---|
| `fabric` still in `package.json` (unused) | `package.json` | `npm uninstall fabric` |
| Stripe webhook signature not verified | `server/api/payment/webhook.post.ts` | Complete `stripe.webhooks.constructEvent()` call |
| Postgres auto-init on cold start missing | `server/db/schema.ts` | Nitro plugin: `CREATE TABLE IF NOT EXISTS ...` |
| `any` types in `useOverlay` / `editor.vue` | Multiple | Add proper Konva node type wrappers |
| Text state polling via `setInterval 300ms` | `pages/editor.vue` | Replace with Konva event → `defineExpose` |

---

## 12. What Is NOT Yet Implemented (Phase 3)

Do not assume these exist:
- Undo / Redo (history stack planned but not built)
- Toast notifications (errors are `console.error` silently)
- Mobile / responsive layout (desktop only)
- Rate limiting
- Cleanup cron job (`/api/cleanup` does not exist yet)
- Document ownership / signed download URLs
- Content-Security-Policy headers

---

## 13. Development Commands

```bash
npm run dev         # Start dev server — http://localhost:3000
npm run build       # Production build
npm run lint        # ESLint (stylistic rules enabled)
npm run typecheck   # nuxt typecheck (vue-tsc)
```

No environment variables are needed for local dev. All features work in mock mode out of the box.

---

## 14. Code Style

- Single quotes for strings.
- No semicolons (ESLint stylistic config enforces this).
- 2-space indentation.
- `async/await` over `.then()` chains.
- Descriptive variable names — no single-letter names except loop indices.
- Only comment code that genuinely needs clarification. No obvious comments.
- Composables follow the `useXxx()` naming pattern and return a plain object of state + methods.
- Do not use the Options API — Composition API (`<script setup>`) only.
