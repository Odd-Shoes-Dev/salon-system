# System Architecture

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | Neon PostgreSQL (serverless) |
| DB Client | `@neondatabase/serverless` — tagged template SQL |
| Auth | Custom session tokens (bcrypt PIN hash, `auth_token` cookie) |
| File Storage | ImageKit (logos, images) |
| SMS | eSMS Africa (`ESMS_API_KEY`) — Airtel numbers only |
| Styling | Tailwind CSS |
| Charts | Recharts |
| PDF Export | jsPDF (programmatic — no DOM screenshot) |

---

## Project Layout

```
src/
  app/                  # Next.js App Router pages + API routes
    api/                # All backend endpoints (one folder per resource)
    dashboard/          # Dashboard page
    pos/                # Point-of-sale page
    clients/            # Client management
    staff/              # Staff management
    workers/            # Workers (service staff) management
    bookings/           # Booking calendar
    services/           # Service catalogue
    reports/            # Reports & analytics
    expenses/           # Expense tracking
    inventory/          # Stock management
    accounts/           # Cash/MoMo account ledger
    settings/           # Salon settings (loyalty, SMS, branding…)
    birthdays/          # Birthday alerts
    loyalty/            # Loyalty tiers
    login/              # Login page
  components/           # Shared UI components
  contexts/             # React contexts (Salon, User, Sidebar, Esc)
  lib/
    db.ts               # Neon SQL client
    auth.ts             # Session auth helpers
    esms.ts             # SMS sending
    payments.ts         # Mobile money
    tenants.ts          # Multi-tenant resolution
    utils.ts            # General helpers
  types/index.ts        # TypeScript interfaces for all DB models
  middleware.ts         # Subdomain/custom-domain routing + auth guard
neon/
  migrations/           # Ordered SQL migration files (run in Neon SQL Editor)
docs/                   # This documentation folder
```

---

## Multi-Tenancy

Every table carries a `salon_id` UUID column. All queries are scoped by `salon_id` — one database, many salons.

Tenant resolution happens in `middleware.ts` and `lib/tenants.ts`:

1. **Subdomain** — `elite.blueoxgroup.eu` → looks up `salons.subdomain = 'elite'`
2. **Custom domain** — `poshnailcare.com` → looks up `salons.custom_domain = 'poshnailcare.com'`
3. **Localhost / Vercel default** → resolves to the `posh` subdomain (dev tenant)

---

## Authentication Flow

1. User visits `/login`, enters phone + 4-digit PIN.
2. `POST /api/auth/login` looks up `staff` by `(salon_id, phone)`, verifies PIN against `pin_hash` (bcrypt).
3. A random `token` is inserted into the `sessions` table with a 30-day `expires_at`.
4. Token is set as an HTTP-only cookie `auth_token`.
5. Every API route calls `getCurrentUser()` from `lib/auth.ts`, which reads the cookie, looks up the session, and returns `{ id, name, phone, email, role, salon_id }`.
6. Logout calls `DELETE /api/auth/logout`, removes the session row, and clears the cookie.

Password-based login (`password_hash`) exists for future web login but PIN is the primary method.

---

## Neon-specific Patterns

```ts
// Neon returns NUMERIC columns as strings — always wrap in Number()
const price = Number(row.price);

// Neon returns TIMESTAMPTZ as Date objects — use new Date() before .toISOString()
const date = new Date(row.created_at).toISOString().split('T')[0];

// Destructure single-row queries
const [row] = await sql`SELECT * FROM salons WHERE id = ${id}`;
```

---

## Branding & Theming

Each salon has `theme_primary_color` (hex). Components use `useSalon()` from `SalonContext` to get this value and apply it via `style={{ color: brandColor }}` or `style={{ backgroundColor: brandColor }}`. Tailwind's `brand-primary` utility maps to CSS variable `--brand-primary` set in the layout.

---

## Migrations

Migrations live in `neon/migrations/` and are run **manually** in the Neon SQL Editor (not via a migration runner). They are numbered and must be run in order:

| File | Purpose |
|---|---|
| `001_schema.sql` | Full base schema — all core tables |
| `002_engagement_tables.sql` | WhatsApp, feedback, scheduled messages, CS tasks |
| `003_add_booking_tables.sql` | Booking system (booking_settings, staff_schedules, bookings) |
| `004_booking_workers_fk.sql` | FK fix: bookings.staff_id → workers(id) |
| `005_balance_tracking.sql` | Partial payment columns on visits |
