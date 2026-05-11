# API Endpoints Reference

All API routes live under `src/app/api/`. Every route reads `salon_id` from the authenticated session via `getCurrentUser()` — no endpoint accepts `salon_id` as a user-supplied parameter.

All routes return JSON. Error responses follow `{ error: "message" }` with an appropriate HTTP status code.

---

## Auth

### `POST /api/auth/login`
Log in with phone + PIN.

**Request body:**
```json
{ "phone": "0781234567", "pin": "1234" }
```
**Response:** `{ "success": true, "user": { "id", "name", "role", "salon_id" } }`  
Sets `auth_token` HTTP-only cookie (30-day session).

---

### `POST /api/auth/logout`
Clears the session from the database and removes the cookie.

---

### `GET /api/auth/me`
Returns the currently authenticated user.

**Response:** `{ "id", "name", "phone", "email", "role", "salon_id" }`

---

## Clients

### `GET /api/clients`

Query params:
- `search` — filter by name or phone
- `paginated=true` — returns paginated shape `{ data: Client[], pagination: {...}, summary: {...} }`
- `pageSize` — records per page (default 30)
- `page` — page number
- Without `paginated` — returns a plain array

> **Important:** The reports page requires `paginated=true` to get the `{ data: [] }` shape.

---

### `POST /api/clients`
Create a new client.

**Request body:** `{ name, phone, birthday?, referral_source_id? }`

---

### `GET /api/clients/[id]`
Get a single client with their visit history.

---

### `PATCH /api/clients/[id]`
Update client details.

---

### `DELETE /api/clients/[id]`
Soft-deletes the client (sets `deleted_at`).

---

### `GET /api/clients/balances`
Returns clients with `balance_due > 0`. Used for the "outstanding balances" feature.

---

## Visits (POS Checkout)

### `GET /api/visits`
List visits for the salon. Query params: `clientId`, `from`, `to`, `page`, `pageSize`.

---

### `POST /api/visits`
**Creates a new visit (checkout).** This is the main POS endpoint.

**Request body:**
```json
{
  "client_id": "uuid",
  "worker_id": "uuid",
  "services": [{ "service_id": "uuid", "quantity": 1, "price": 50000 }],
  "addons": [{ "addon_id": "uuid", "quantity": 1, "price": 5000 }],
  "payment_method": "cash",
  "amount_paid": 55000,
  "checkout_discount": 0,
  "loyalty_points_redeemed": 0
}
```

**Side effects:**
- Inserts `visit_services` and `visit_addons` rows
- Updates `clients.loyalty_points`, `clients.total_spent`, `clients.total_visits`
- Creates `account_transactions` row
- Generates receipt number `SALONCODE-YYMMDD-XXXX`

---

### `PATCH /api/visits/[id]`
Record a balance payment on a partially paid visit.

**Request body:** `{ "amount": 20000, "payment_method": "mtn" }`

---

### `DELETE /api/visits/[id]`
Soft-deletes a visit (sets `is_active = false`, `deleted_at`). Requires `owner` or `admin` role.

---

## Services

### `GET /api/services`
Returns all active services for the salon. Optional query param: `category_id`.

### `POST /api/services`
Create a service. Body: `{ name, price, duration_minutes?, category_id?, gender_target? }`

### `PATCH /api/services/[id]`
Update a service.

### `DELETE /api/services/[id]`
Soft-delete a service.

---

## Service Categories

### `GET /api/categories`
List all categories for the salon.

### `POST /api/categories`
Create a category. Body: `{ name, color?, icon? }`

### `PATCH /api/categories/[id]`
Update.

### `DELETE /api/categories/[id]`
Delete (only if no services reference it).

---

## Addons

### `GET /api/addons`
List addons.

### `POST /api/addons`
Create addon. Body: `{ name, price, category? }`

### `PATCH /api/addons/[id]` / `DELETE /api/addons/[id]`
Update / soft-delete.

---

## Users (`/api/staff`)

> These are the login accounts — the `staff` database table. Called **"Users"** in the frontend UI.

### `GET /api/staff`
List all login users for the salon.

### `POST /api/staff`
Create a login account. Body: `{ name, phone, role, pin, email? }`

---

## Staff (`/api/workers`)

> These are the service providers — the `workers` database table. Called **"Staff"** in the frontend UI.

### `GET /api/workers`
List all staff members (service providers) for the salon.

### `POST /api/workers`
Create a staff member. Body: `{ name, phone?, job_title? }`

### `GET /api/workers/ledger`
Returns per-staff-member sales summary (total revenue, visit count, average rating) for a date range. Query params: `from`, `to`.

---

## Bookings

### `GET /api/bookings`
List bookings. Query params: `date`, `status`, `staff_id` (worker ID).

### `POST /api/bookings`
Create a booking. Body: `{ service_id, staff_id (worker), booking_date, start_time, client_id?, guest_name?, guest_phone? }`

### `PATCH /api/bookings/[id]`
Update status or details.

### `DELETE /api/bookings/[id]`
Cancel a booking.

### `GET /api/bookings/availability`
Returns available time slots for a worker on a date. Query params: `worker_id`, `date`, `service_id`.

### `GET /api/bookings/settings`
Returns `booking_settings` for the salon.

### `PATCH /api/bookings/settings`
Update booking configuration (buffer, advance days, cancellation hours, working hours).

### `GET /api/bookings/schedules`
Returns `staff_schedules` (weekly availability per worker).

### `POST /api/bookings/schedules`
Create or update a worker's schedule for a day.

---

## Reports

### `GET /api/reports`
Overview statistics. Query params: `from`, `to`.

**Response includes:**
- `totalRevenue`, `totalVisits`, `totalClients`
- `paymentMethods` — breakdown by payment method
- `topServices` — ranked by revenue
- `topClients` — ranked by spend
- `revenueByDay` — daily revenue series for bar chart

---

## Dashboard

### `GET /api/dashboard/stats`
Returns today's stats: revenue, visits, new clients, and chart data.

### `GET /api/dashboard/discounts`
Returns recent discounts given.

---

## Expenses

### `GET /api/expenses`
List expenses. Query params: `from`, `to`, `category`.

### `POST /api/expenses`
Record an expense. Body: `{ amount, description, category, expense_date, payment_method, account_id? }`

### `PATCH /api/expenses/[id]`
Update.

### `DELETE /api/expenses/[id]`
Soft-delete.

---

## Accounts

### `GET /api/accounts`
Returns all accounts with their current balances (from `account_balances` view).

### `GET /api/accounts/[id]/transactions`
Returns transaction history for one account.

---

## Inventory

### `GET /api/inventory/groups` / `POST /api/inventory/groups`
List / create stock groups (categories).

### `PATCH /api/inventory/groups/[id]` / `DELETE /api/inventory/groups/[id]`
Update / delete.

### `GET /api/inventory/items` / `POST /api/inventory/items`
List / create stock items. Items include `current_qty` and `reorder_level`.

### `PATCH /api/inventory/items/[id]` / `DELETE /api/inventory/items/[id]`
Update / soft-delete.

### `POST /api/inventory/movements`
Record a stock adjustment (restock, usage, correction). Body: `{ item_id, qty_change, reason, notes? }`

---

## Loyalty

### `GET /api/loyalty/tiers`
Returns loyalty tiers configured for the salon.

### `POST /api/loyalty/tiers`
Create / update a tier.

---

## Ratings

### `POST /api/ratings`
Submit a visit rating. Body: `{ visit_id, rating (1–5), worker_id? }`  
Constraint: one rating per visit (`UNIQUE(visit_id)` on `staff_ratings`).

---

## Birthdays

### `GET /api/birthdays`
Returns clients with birthdays in the current month (or query param `month`).

### `POST /api/birthdays/[clientId]/send`
Send a birthday SMS to a specific client. Records in `birthday_messages` to prevent duplicates.

---

## SMS

### `POST /api/sms/send`
Send a manual SMS to a client or phone number. Body: `{ phone, message }`.  
**Note:** SMS delivery only works for Airtel numbers (via eSMS Africa).

### `GET /api/sms/template` / `POST /api/sms/template`
Manage SMS message templates.

---

## Settings

### `GET /api/settings`
Returns the salon's full settings record.

### `PATCH /api/settings`
Update settings. Accepts any subset of the `salons` column set (name, slogan, theme, loyalty config, SMS toggles, etc.).

### `POST /api/settings/logo`
Upload salon logo to ImageKit. Body: `multipart/form-data` with `file`.

---

## Staff Advances

### `GET /api/staff-advances`
List advances (filterable by `staff_id`, `status`).

### `POST /api/staff-advances`
Record a new advance. Body: `{ staff_id, amount, reason? }`.

### `PATCH /api/staff-advances/[id]`
Update advance status (`deducted` or `cancelled`).

### `DELETE /api/staff-advances/[id]`
Delete an advance record.

---

## Referral Sources

### `GET /api/referral-sources`
List referral sources for the salon.

### `POST /api/referral-sources`
Create a referral source. Body: `{ name }`.

### `PATCH /api/referral-sources/[id]` / `DELETE /api/referral-sources/[id]`
Update / delete.
