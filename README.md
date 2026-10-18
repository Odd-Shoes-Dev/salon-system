# Salon Management System

A multi-tenant, tablet-first management platform for salons and beauty businesses. Handles POS, client management, staff, bookings, inventory, loyalty, SMS, and analytics — all from one web app.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | Neon PostgreSQL (serverless) |
| DB Client | `@neondatabase/serverless` — tagged template SQL |
| Auth | Custom session cookies (bcrypt PIN hash) |
| File Storage | ImageKit (logos, images) |
| SMS | eSMS Africa or Africa's Talking (switchable via `SMS_PROVIDER`) |
| Styling | Tailwind CSS |
| Charts | Recharts |
| PDF Export | jsPDF |

---

## Features

| Area | Route |
|---|---|
| Point of Sale | `/pos` |
| Dashboard | `/dashboard` |
| Clients | `/clients` |
| Bookings | `/bookings` |
| Sales History | `/sales` |
| Services & Categories | `/services`, `/categories` |
| Staff (service workers) | `/workers` |
| Users (system logins) | `/staff` |
| Loyalty | `/loyalty` |
| Reports & Analytics | `/reports` |
| Expenses | `/expenses` |
| Accounts (cash/MoMo ledger) | `/accounts` |
| Inventory | `/inventory` |
| SMS Campaigns | `/sms` |
| Birthday Alerts | `/birthdays` |
| Salon Settings | `/settings` |

> See [`docs/`](./docs/) for detailed developer reference.

---

## Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) PostgreSQL project
- An [ImageKit](https://imagekit.io) account (for logo uploads)
- An SMS provider account — either [eSMS Africa](https://www.esmsafrica.com) or [Africa's Talking](https://africastalking.com) (see SMS config below)

---

## Setup

### 1. Install dependencies

```bash
cd salon-system
npm install
```

### 2. Configure environment variables

Create a `.env.local` file at the project root:

```env
# Neon PostgreSQL connection string
DATABASE_URL=postgresql://user:password@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# MTN numbers (076/077/078/079) always route through sms.ug below, regardless
# of SMS_PROVIDER — neither eSMS nor Africa's Talking can reach MTN on this
# account. SMS_PROVIDER picks the provider for everything else (Airtel etc).
SMS_PROVIDER=africastalking

# sms.ug — required for MTN delivery regardless of SMS_PROVIDER above
SMSUG_API_KEY=

# --- If SMS_PROVIDER=esms ---
# eSMS Africa
ESMS_API_KEY=

# --- If SMS_PROVIDER=africastalking ---
# Africa's Talking
AT_API_KEY=
AT_USERNAME=
AT_SENDER_ID=

# ImageKit — required for logo uploads
IMAGEKIT_PUBLIC_KEY=
IMAGEKIT_PRIVATE_KEY=
IMAGEKIT_URL_ENDPOINT=

# Domain routing — subdomain used for multi-tenant resolution
NEXT_PUBLIC_ROOT_DOMAIN=blueoxgroup.eu
```

Full variable reference: [`docs/environment-variables.md`](./docs/environment-variables.md)

### 3. Run database migrations

Open the [Neon SQL Editor](https://console.neon.tech) and run each file in order:

```
neon/migrations/001_schema.sql
neon/migrations/002_engagement_tables.sql
neon/migrations/003_add_booking_tables.sql
...
neon/migrations/028_soft_delete_stock_groups.sql
```

Run them **in numeric order**. Each migration builds on the previous one.

### 4. Start the dev server

```bash
npm run dev
```

App runs at **http://localhost:3001**

---

## Checks to Run

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# Production build (catches build-time errors)
npm run build
```

---

## Multi-Tenancy

Each salon gets a subdomain (e.g. `posh.blueoxgroup.eu`). Locally, `localhost:3001` resolves to the `posh` tenant automatically via middleware.

See [`docs/domain-routing.md`](./docs/domain-routing.md) for the full URL convention.

---

## Developer Docs

| Doc | Contents |
|---|---|
| [`docs/architecture.md`](./docs/architecture.md) | Stack, project layout, auth flow |
| [`docs/database-schema.md`](./docs/database-schema.md) | All tables and columns |
| [`docs/api-endpoints.md`](./docs/api-endpoints.md) | Every API route |
| [`docs/permissions.md`](./docs/permissions.md) | Role-based access control matrix |
| [`docs/staff-vs-workers.md`](./docs/staff-vs-workers.md) | Critical naming distinction in the codebase |
| [`docs/environment-variables.md`](./docs/environment-variables.md) | All env vars with setup instructions |
| [`docs/domain-routing.md`](./docs/domain-routing.md) | Multi-tenant URL routing |
| [`docs/neon-and-imagekit.md`](./docs/neon-and-imagekit.md) | Neon DB and ImageKit setup |
