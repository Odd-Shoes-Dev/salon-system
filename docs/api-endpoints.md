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
Returns today's stats: revenue, visits, new clients, and chart data. Includes `pendingBookings` (count of `status = 'pending'` bookings) — powers the dashboard's "Pending Bookings" card, which links to `/bookings?status=pending`.

### `GET /api/dashboard/discounts`
Returns recent discounts given.

---

## Expenses

### `GET /api/expenses`
List expenses. Query params: `from`/`to` (or `from_date`/`to_date`), `category`, `payment_method`, `minAmount`, `maxAmount`, `search`.

**Response:** `{ expenses: [...], summary: { total, count, revenue, netProfit, byCategory, byCategoryGrouped, byPaymentMethod }, period }`
`byCategoryGrouped` rolls categories up into their optional parent group (see [Expense Category Groups](#expense-category-groups)) — ungrouped categories pass through as-is.

### `POST /api/expenses`
Record an expense. Body: `{ category, amount, description?, expense_date?, payment_method }`.  
`payment_method` is `cash` / `mtn_mobile_money` / `airtel_money` / `other`. For anything other than `other`, this writes an `out` entry on the salon's matching **system** account (not a chosen `account_id`) — rejects with `400 Insufficient balance...` if that account can't cover it. `other` skips the account movement entirely (e.g. for a non-cash expense).

### `PATCH /api/expenses/[id]`
Update. Same balance check as create — if the amount/payment method changes, it credits back the old transaction's amount on its account before checking whether the new amount fits.

### `DELETE /api/expenses/[id]`
Soft-delete. Also removes the linked `account_transactions` row.

---

## Expense Category Groups

Optional grouping for expense categories (e.g. a "Fixed Costs" group containing Rent/Insurance/Salaries). Purely organisational — a category's `group_id` is nullable, so salons that don't want grouping just leave categories ungrouped.

### `GET /api/expense-category-groups`
Returns `{ groups: [{ id, name, sort_order }] }`.

### `POST /api/expense-category-groups`
Create a group. Body: `{ name }`. 409 if a group with that name (case-insensitive) already exists.

### `PATCH /api/expense-category-groups/[id]` / `DELETE /api/expense-category-groups/[id]`
Rename / soft-delete a group. Deleting a group does not delete its categories — they just fall back to ungrouped.

### `GET /api/expense-categories` / `POST /api/expense-categories` / `PATCH /api/expense-categories/[id]`
Category CRUD now also accepts `group_id` (nullable).

---

## Accounts

### `GET /api/accounts`
Returns all accounts with their current balances (from `account_balances` view). Balances can be **negative** — the UI shows the true sign (red) rather than hiding it.

### `GET /api/accounts/[id]/transactions`
Returns transaction history for one account. Query params: `from`, `to`, `limit` (max 200). Includes `reversed_at` (set once a transfer leg has been reversed).

### `POST /api/accounts/[id]/transactions`
Record a manual transaction directly on one account. Body: `{ amount, direction: 'in'|'out', description?, transaction_date? }`.

### `POST /api/accounts/transfer`
Move money between two of the salon's own accounts. Body: `{ from_account_id, to_account_id, amount, description?, transaction_date? }`.  
Creates a linked `out`/`in` pair (`reference_type: 'transfer'`, each leg's `reference_id` points at the other). Rejects with `400 Insufficient balance...` if the source account can't cover it.

### `POST /api/accounts/transactions/[id]/reverse`
Corrects a wrong transfer **without editing the original record** — posts a new correcting `out`/`in` pair (`reference_type: 'transfer_reversal'`) that moves the money back, and marks both legs of the original pair `reversed_at` so they can't be reversed twice. `id` can be either leg of the original transfer. Rejects if the destination account can no longer cover the amount, or if the transfer was already reversed.

> **Balance floor:** Every flow that debits an account — transfers, staff advances, expenses, purchases, and liability repayments — rejects with `400 { error: "Insufficient balance. {account} has {X} UGX available." }` if the amount exceeds that account's current balance. Shared via `checkAccountBalance()` in `src/lib/accounts.ts`.

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
Routed by network — MTN numbers go through sms.ug, everything else through whichever provider `SMS_PROVIDER` selects (eSMS Africa or Africa's Talking). See [environment-variables.md](./environment-variables.md#sms).

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

## Staff Advances (Debtors)

A cash advance given to staff is a **receivable** — see `staff_advances_receivable` on the [balance sheet](#balance-sheet). Repayment is a separate step from the advance itself, so partial repayments and two different repayment methods are both tracked.

### `GET /api/staff-advances`
List advances for the salon (optionally filtered by `?status=`). Each row includes `amount`, `amount_repaid`, `status`, `account_id`.

### `POST /api/staff-advances`
Give an advance. Body: `{ staff_id, amount, reason?, account_id }`.  
`account_id` is **required** — it's the account the cash actually came out of (previously hardcoded to Cash regardless of what was picked). Rejects with `400 Insufficient balance...` if that account can't cover it.

### `PATCH /api/staff-advances/[id]`
Only accepts `{ status: 'cancelled' }` (voids the advance). Repayment no longer goes through this endpoint — see `/repay` below.

### `DELETE /api/staff-advances/[id]`
Delete an advance record.

### `POST /api/staff-advances/[id]/repay`
Record a repayment. Body: `{ amount, method: 'cash'|'salary_deduction', account_id?, notes? }`.
- **`cash`** — real money came back: requires `account_id`, books an `in` transaction on it (`reference_type: 'advance_repayment'`).
- **`salary_deduction`** — a **contra entry**: the receivable shrinks with no cash movement at all, because the staff member was paid less cash salary than the gross expense recorded elsewhere. This system has no payroll module, so it only clears the receivable side — whoever logs the salary expense is still responsible for recording the reduced cash amount.

`status` becomes `partial` if the repayment doesn't cover the full remaining balance, or `deducted` once fully repaid. Rejects if `amount` exceeds what's still owed.

### `GET /api/staff-advances/ledger?staff_id=X`
Debtors ledger for one staff member — every advance (Dr) and repayment (Cr, labeled by method), chronological, with a running balance. Powers the Reports → Debtors & Creditors tab.

---

## Balance Sheet

### `GET /api/balance-sheet`
Query param: `date` (defaults to today). Returns `{ as_of, assets, liabilities }`.
- `assets.accounts` — live account balances as of that date.
- `assets.inventory_value`, `assets.equipment` (with straight-line depreciation per item).
- `assets.staff_advances_receivable` — sum of `amount - amount_repaid` across all non-cancelled staff advances. This is the receivable that offsets the cash paid out when an advance was given.
- `liabilities.supplier_payables` — outstanding credit purchases.
- `liabilities.other` — manually entered liabilities (loans, rent arrears, etc.), each with `outstanding = total_amount - amount_repaid`.

### Other Liabilities (Creditors)

A loan or other manually-tracked liability. Like staff advances, giving/receiving money and repaying it are separate steps.

#### `GET /api/balance-sheet/liabilities`
List all (non-deleted) liabilities for the salon.

#### `POST /api/balance-sheet/liabilities`
Create one. Body: `{ description, category, total_amount, amount_repaid?, due_date?, notes?, account_id? }`.  
`category` is one of `bank_loan` / `personal_loan` / `rent_arrear` / `equipment_financing` / `other`.  
`account_id` means **this is a new loan being taken out right now** — books the proceeds as an `in` transaction (`reference_type: 'loan'`) on that account. Leave it blank for a **pre-existing** loan balance from before this system was used — no cash movement, matching the original behavior.

#### `PATCH /api/balance-sheet/liabilities/[id]`
Edit `description` / `category` / `total_amount` / `due_date` / `notes` only — `amount_repaid` can no longer be edited directly here (that used to bypass the ledger). Use `/repay` to record a repayment.

#### `POST /api/balance-sheet/liabilities/[id]/repay`
Record a repayment. Body: `{ amount, account_id, notes? }`. Always a real cash movement (no contra-entry concept for loans, unlike staff advances) — books an `out` transaction (`reference_type: 'loan_repayment'`) and increases `amount_repaid`. Rejects if it would exceed `total_amount`, or if the paying account can't cover it.

#### `GET /api/balance-sheet/liabilities/[id]/ledger`
Creditors ledger for one loan — the loan itself (Cr) and every repayment (Dr), chronological, with a running balance. Powers the Reports → Debtors & Creditors tab.

---

## Referral Sources

### `GET /api/referral-sources`
List referral sources for the salon.

### `POST /api/referral-sources`
Create a referral source. Body: `{ name }`.

### `PATCH /api/referral-sources/[id]` / `DELETE /api/referral-sources/[id]`
Update / delete.
