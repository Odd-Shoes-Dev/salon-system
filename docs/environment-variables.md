# Environment Variables

Copy these to a `.env.local` file at the project root for local development. On Vercel/production, add them in the project environment settings.

---

## Required

### `DATABASE_URL`
Neon PostgreSQL connection string.

```
DATABASE_URL=postgresql://user:password@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

Get this from: **Neon Console → Your Project → Connection Details → Connection String**.

---

### SMS

SMS is sent through `src/lib/sms/` (`smsProvider.sendMessage()`), which routes by the recipient's network rather than using a single provider for everything:

- **MTN numbers** (Uganda prefixes 076/077/078/079) always go through **sms.ug** — neither eSMS Africa nor Africa's Talking can deliver to MTN on this account. Requires `SMSUG_API_KEY`.
- **Everything else** uses whichever provider `SMS_PROVIDER` selects — `esms` (default) or `africastalking`.

```
SMS_PROVIDER=africastalking   # or "esms"
SMSUG_API_KEY=your_smsug_api_key

# If SMS_PROVIDER=esms:
ESMS_API_KEY=your_esms_api_key

# If SMS_PROVIDER=africastalking:
AT_API_KEY=your_at_api_key
AT_USERNAME=your_at_username
AT_SENDER_ID=your_registered_sender_id   # optional
```

Get `ESMS_API_KEY` from **eSMS Africa dashboard → API credentials**, `AT_*` from **Africa's Talking → account.africastalking.com**, and `SMSUG_API_KEY` from **sms.ug dashboard → Settings → API Settings**.

> **Note:** eSMS Africa itself only delivers to Airtel numbers — that's exactly why MTN is routed to sms.ug instead. The system as a whole reaches both networks; no single provider here covers both on its own.
>
> **sms.ug content filter:** rejects any message containing the literal words "code", "OTP", or "passcode" (confirmed by testing) — avoid those words in message text sent through it.

---

## Required for Logo Uploads

### `IMAGEKIT_PUBLIC_KEY`
### `IMAGEKIT_PRIVATE_KEY`
### `IMAGEKIT_URL_ENDPOINT`

ImageKit credentials for uploading salon logos.

```
IMAGEKIT_PUBLIC_KEY=public_xxxxxxxxxxxx
IMAGEKIT_PRIVATE_KEY=private_xxxxxxxxxxxx
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id
```

Get these from: **ImageKit Console → Developer Options**.

### `IMAGEKIT_APP_FOLDER` *(optional)*
Folder inside ImageKit where uploads are stored. Defaults to `salon-system`.

```
IMAGEKIT_APP_FOLDER=salon-system
```

---

## Optional / Future Use

These are referenced in the code but currently commented out. Do not set them unless you are implementing the corresponding feature.

| Variable | Purpose |
|---|---|
| `WHATSAPP_API_KEY` | WhatsApp Business API key |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp sender phone number ID |
| `MTN_MOMO_API_KEY` | MTN Mobile Money collection API |
| `MTN_MOMO_API_USER` | MTN MoMo API user UUID |
| `AIRTEL_MONEY_API_KEY` | Airtel Money collection API |

---

## Full `.env.local` Template

```env
# === REQUIRED ===

# Neon PostgreSQL
DATABASE_URL=postgresql://...

# SMS — MTN always routes through sms.ug; SMS_PROVIDER picks the rest
SMS_PROVIDER=africastalking
SMSUG_API_KEY=
ESMS_API_KEY=

# === REQUIRED FOR LOGO UPLOADS ===

IMAGEKIT_PUBLIC_KEY=
IMAGEKIT_PRIVATE_KEY=
IMAGEKIT_URL_ENDPOINT=

# Optional: folder name inside ImageKit
# IMAGEKIT_APP_FOLDER=salon-system

# === OPTIONAL / FUTURE ===

# WHATSAPP_API_KEY=
# WHATSAPP_PHONE_NUMBER_ID=
# MTN_MOMO_API_KEY=
# MTN_MOMO_API_USER=
# AIRTEL_MONEY_API_KEY=
```

---

## Notes

- **No `NEXT_PUBLIC_` variables are required.** Branding, salon name, and theme colors are all loaded from the database at runtime, not from env vars.
- **No `NEXTAUTH_SECRET` or similar.** Auth is fully custom (see [architecture.md](./architecture.md)).
- The dev server runs on port 3001 (`next dev -p 3001`). Localhost resolves to the `posh` tenant automatically.
