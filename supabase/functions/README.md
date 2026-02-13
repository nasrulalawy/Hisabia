# Supabase Edge Functions

Pembayaran subscription via Midtrans Snap — berjalan di Supabase, tidak perlu server Node.js.

## Deploy

```bash
# Login & link project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Set secrets (Server Key dari Midtrans Dashboard)
supabase secrets set MIDTRANS_SERVER_KEY=Mid-server-xxx
supabase secrets set MIDTRANS_IS_PRODUCTION=true

# Deploy
supabase functions deploy create-subscription-order
supabase functions deploy midtrans-webhook --no-verify-jwt
```

## Webhook URL

Di Midtrans Dashboard → Settings → Configuration → Notification URL:
```
https://[PROJECT_REF].supabase.co/functions/v1/midtrans-webhook
```

Ganti `[PROJECT_REF]` dengan project ID Supabase (mis. `tmuiumuxxhdjxfssqpmi`).
