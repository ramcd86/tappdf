# tapPDF

A lightweight, friction-free PDF editor with a pay-to-download model. No accounts, no subscriptions — upload or create a PDF, make your edits, pay once, download.

## Goal

Make simple PDF editing as fast as possible. The product targets users who need to annotate, stamp, or add content to a PDF without signing up for a SaaS tool. A single small payment unlocks the download.

## How it works

1. **Upload** an existing PDF or create a blank A4 document
2. **Edit** — add text, images, shapes, and highlights on an interactive canvas overlaid on the PDF
3. **Pay** — a one-time payment (€0.99) via Stripe unlocks the download
4. **Download** — the edited PDF is generated server-side with all overlays baked in

Files are stored temporarily and expire after 24 hours. No account is required at any point.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | [Nuxt 3](https://nuxt.com) (Vue 3 + Nitro) |
| Canvas editor | [Konva.js](https://konvajs.org) |
| PDF rendering | [PDF.js](https://mozilla.github.io/pdf.js/) (`pdfjs-dist`) |
| PDF generation | [pdf-lib](https://pdf-lib.js.org) |
| Payments | [Stripe](https://stripe.com) (Payment Elements) |
| Storage | [Vercel Blob](https://vercel.com/storage/blob) (local filesystem in dev) |
| Database | [Vercel Postgres](https://vercel.com/storage/postgres) + Drizzle ORM (in-memory mock in dev) |
| Styling | [Tailwind CSS](https://tailwindcss.com) |
| Deployment | [Vercel](https://vercel.com) |

## Running locally

```bash
npm install
npm run dev       # http://localhost:3000
```

No environment variables are required for local development — storage, database, and Stripe all run in mock mode automatically.

For production, set the following in your environment:

```
STRIPE_SECRET_KEY=
NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
BLOB_READ_WRITE_TOKEN=
POSTGRES_URL=
```
