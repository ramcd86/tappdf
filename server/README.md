# ======================
# tapPDF Backend API - Testing Guide
# ======================

## Local Development Setup

### 1. Environment Setup
```bash
# Copy the example env file
cp .env.example .env

# For local testing with mocks, use these settings:
NODE_ENV=development
BASE_URL=http://localhost:3000
PAYMENT_AMOUNT=99
PAYMENT_CURRENCY=eur
FILE_EXPIRY_HOURS=24

# Mock Stripe (no real payment processing)
STRIPE_SECRET_KEY=mock_sk_test_123
STRIPE_PUBLISHABLE_KEY=pk_test_your_key
STRIPE_WEBHOOK_SECRET=mock_webhook_secret

# Leave these empty to use local mocks
BLOB_READ_WRITE_TOKEN=
POSTGRES_URL=
```

### 2. Start Development Server
```bash
npm run dev
```

## API Endpoints

### 1. Upload PDF
**POST** `/api/upload`

Upload a PDF file to start editing.

**Request:**
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@sample.pdf"
```

**Response:**
```json
{
  "success": true,
  "documentId": "abc123",
  "uploadUrl": "/api/storage/upload-1234567890.pdf",
  "expiresAt": "2026-01-31T12:00:00.000Z",
  "size": 1024000
}
```

---

### 2. Create Payment Intent
**POST** `/api/payment/create-intent`

Create a payment intent for downloading the edited PDF.

**Request:**
```bash
curl -X POST http://localhost:3000/api/payment/create-intent \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "abc123",
    "overlayData": [
      {
        "id": "text1",
        "page": 0,
        "type": "text",
        "x": 100,
        "y": 100,
        "data": {
          "text": "Hello World",
          "fontSize": 24,
          "color": "#FF0000"
        }
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "clientSecret": "pi_mock_1234_secret_abc",
  "paymentIntentId": "pi_mock_1234",
  "amount": 99,
  "currency": "eur"
}
```

---

### 3. Webhook (Stripe)
**POST** `/api/payment/webhook`

Receives Stripe webhook events. In mock mode, you can manually trigger this.

**Mock Payment Success:**
```bash
curl -X POST http://localhost:3000/api/payment/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: mock_signature" \
  -d '{
    "type": "payment_intent.succeeded",
    "data": {
      "object": {
        "id": "pi_mock_1234",
        "status": "succeeded"
      }
    }
  }'
```

**Response:**
```json
{
  "received": true
}
```

---

### 4. Generate PDF
**POST** `/api/generate`

Generate the final PDF with overlays applied.

**Request:**
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "abc123"
  }'
```

**Response:**
```json
{
  "success": true,
  "downloadUrl": "/api/storage/final-abc123-1234567890.pdf",
  "documentId": "abc123",
  "expiresAt": "2026-01-30T13:00:00.000Z"
}
```

---

### 5. Download PDF
**GET** `/api/download/[id]`

Download the generated PDF.

**Request:**
```bash
curl -O http://localhost:3000/api/download/abc123
```

**Response:** PDF file binary data

---

## Testing Flow

### Complete End-to-End Test

```bash
# 1. Upload a PDF
UPLOAD_RESPONSE=$(curl -X POST http://localhost:3000/api/upload \
  -F "file=@test.pdf" -s)

DOC_ID=$(echo $UPLOAD_RESPONSE | jq -r '.documentId')
echo "Document ID: $DOC_ID"

# 2. Create payment intent with overlays
PAYMENT_RESPONSE=$(curl -X POST http://localhost:3000/api/payment/create-intent \
  -H "Content-Type: application/json" \
  -d "{
    \"documentId\": \"$DOC_ID\",
    \"overlayData\": [{
      \"id\": \"text1\",
      \"page\": 0,
      \"type\": \"text\",
      \"x\": 100,
      \"y\": 100,
      \"data\": {
        \"text\": \"EDITED\",
        \"fontSize\": 48,
        \"color\": \"#FF0000\"
      }
    }]
  }" -s)

PAYMENT_ID=$(echo $PAYMENT_RESPONSE | jq -r '.paymentIntentId')
echo "Payment Intent: $PAYMENT_ID"

# 3. Simulate successful payment webhook
curl -X POST http://localhost:3000/api/payment/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: mock_sig" \
  -d "{
    \"type\": \"payment_intent.succeeded\",
    \"data\": {
      \"object\": {
        \"id\": \"$PAYMENT_ID\"
      }
    }
  }" -s

# 4. Wait for PDF generation (triggered by webhook)
sleep 2

# 5. Download the final PDF
curl -o final.pdf http://localhost:3000/api/download/$DOC_ID

echo "Downloaded final.pdf"
```

---

## Mock Behavior

### Local Storage (Blob Mock)
- Files stored in `.storage/` directory
- Access files via `/api/storage/[filename]`
- No authentication required

### Database (Postgres Mock)
- In-memory storage using JavaScript Maps
- Data lost on server restart
- Logged to console for debugging

### Stripe (Payment Mock)
- No real payments processed
- Always returns success
- Generates mock payment intent IDs
- Webhook signatures not verified

---

## Switching to Production

### 1. Set up Vercel Blob
```bash
# Install Vercel CLI
npm i -g vercel

# Link project and create storage
vercel link
vercel env add BLOB_READ_WRITE_TOKEN
```

### 2. Set up Vercel Postgres
```bash
# Create Postgres database
vercel postgres create

# Copy connection strings to .env
```

### 3. Set up Stripe
1. Create account at https://stripe.com
2. Get API keys from dashboard
3. Configure webhook endpoint: `https://yourdomain.com/api/payment/webhook`
4. Copy webhook secret
5. Update .env with real keys (remove 'mock_' prefix)

### 4. Deploy
```bash
vercel --prod
```

---

## Troubleshooting

### Files not found
- Check `.storage/` directory exists
- Verify file permissions
- Check console logs for errors

### Payment not working
- Verify STRIPE_SECRET_KEY is set
- Check webhook payload format
- Review server logs

### PDF generation fails
- Verify overlay data format
- Check original PDF is valid
- Review pdf-lib errors in logs

### Database errors
- Check POSTGRES_URL is set (or empty for mock)
- Verify schema is initialized
- Check connection logs
