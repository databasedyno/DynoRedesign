# $10 ETH Payment Created Successfully! 🎉

## Payment Details

**Transaction ID**: `f5aff13a-5944-4086-85e9-7b8aead9a180`

**Payment Address (ETH)**:
```
0xdb0c01c41879d877654050002e6e6f283841c9c3
```

**Amount to Pay**:
- **USD**: $10.00
- **ETH**: 0.00485354 ETH

**Currency**: ETH (Ethereum)

**Company**: Bozzmail (company_id: 38)

**Redirect URI**: https://bozzmail.pt/payment-success

**Meta Data**:
- Order ID: TEST-ETH-001
- Description: Test $10 ETH payment

---

## Payment Instructions

To complete this payment, send **exactly 0.00485354 ETH** to:

```
0xdb0c01c41879d877654050002e6e6f283841c9c3
```

### QR Code
A QR code has been generated and included in the response (base64 encoded image).

---

## Payment Flow

1. ✅ **Payment Created** - The payment link has been generated
2. ⏳ **Awaiting Payment** - Waiting for ETH to be sent to the address
3. 🔄 **Confirmation** - Once received, the payment will be confirmed
4. 💰 **Auto-Conversion** - Since Bozzmail has auto-conversion enabled:
   - The ETH will be automatically converted to USDT
   - Settlement currency: USDT (TRC20)
   - Settlement address: TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR

---

## API Request Used

```bash
curl -X POST "http://localhost:8001/api/user/cryptoPayment" \
  -H "x-api-key: U2FsdGVkX19Fbz0HjAKTmYIjkewr7hiChL6n8K2E1l1vqo9CrGVhIv8aJBqeWAtpAUFVkq/99fofaF5lZ1Bp8vjTzhDFR8DwL7h3RmQD3Kni28pIwZp271JHuvJAOp+7cjpCj9by2lE+yuP3ldL1ut9/DPGpm08sQ57Qn8Oeco8=" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10,
    "currency": "ETH",
    "redirect_uri": "https://bozzmail.pt/payment-success",
    "fee_payer": "company",
    "meta_data": {
      "order_id": "TEST-ETH-001",
      "description": "Test $10 ETH payment"
    }
  }'
```

---

## Testing the Payment

You can monitor the payment status by:

1. **Check Transaction Status**:
```bash
curl -X GET "http://localhost:8001/api/user/getSingleTransaction/f5aff13a-5944-4086-85e9-7b8aead9a180" \
  -H "x-api-key: YOUR_API_KEY"
```

2. **Check by Address**:
```bash
curl -X GET "http://localhost:8001/api/user/getCryptoTransaction/0xdb0c01c41879d877654050002e6e6f283841c9c3" \
  -H "x-api-key: YOUR_API_KEY"
```

---

## Notes

- The payment is currently in "Awaiting Payment" status
- Once ETH is received, DynoPay will automatically:
  - Confirm the transaction
  - Deduct platform fees (1.5% + $1.00 fixed fee)
  - Convert ETH to USDT via Binance (auto-conversion enabled)
  - Transfer USDT to merchant's settlement address
  - Send email notifications
- Payment expiration: Check the grace period settings (if configured)

---

**Created**: February 13, 2026
**User**: richard@dyno.pt
**Company**: Bozzmail
**Status**: ✅ Active - Awaiting Payment
