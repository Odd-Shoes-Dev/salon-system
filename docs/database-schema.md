# Database Schema Reference

Database: **Neon PostgreSQL** (serverless).  
All tables use `uuid` primary keys generated with `gen_random_uuid()`.  
All timestamps are `timestamptz` (UTC).  
All tables include `salon_id uuid NOT NULL` — every query must be scoped to a salon.

---

## salons

The top-level tenant record. One row per salon.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | varchar NOT NULL | Display name |
| `phone` | varchar NOT NULL | |
| `email` | varchar | |
| `address` | text | |
| `city` | varchar | |
| `logo_url` | text | ImageKit URL |
| `slogan` | varchar | Tagline shown on receipts |
| `subdomain` | varchar UNIQUE | e.g. `posh` → `posh.blueoxgroup.eu` |
| `custom_domain` | varchar | e.g. `poshnailcare.com` |
| `theme_primary_color` | varchar | Hex, default `#2563EB` |
| `theme_secondary_color` | varchar | Hex, default `#F59E0B` |
| `loyalty_points_per_ugx` | integer | Points earned per 1 000 UGX spent |
| `loyalty_threshold` | integer | Points needed to redeem a reward |
| `is_active` | boolean | Soft-disable a tenant |
| `subscription_plan` | varchar | `trial` / `basic` / `pro` / `enterprise` |
| `subscription_expires_at` | timestamptz | |
| `birthday_discount_percent` | integer | Default birthday discount (0 = off) |
| `birthday_sms_enabled` | boolean | |
| `referral_points_reward` | integer | Points given to referrer |
| `referral_sms_enabled` | boolean | |

---

## staff

> **Frontend name: "Users"** — these are the people who log in and operate the management system.

Do not confuse with the `workers` table, which the frontend calls "Staff".

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `salon_id` | uuid FK → salons | |
| `name` | varchar NOT NULL | |
| `phone` | varchar NOT NULL | |
| `email` | varchar | |
| `role` | varchar | `owner` / `admin` / `manager` / `stylist` / `cashier` / `staff` / `viewer` |
| `pin_hash` | varchar | bcrypt hash of 4-digit PIN |
| `password_hash` | varchar | bcrypt hash (future web login) |
| `is_active` | boolean | Deactivated users cannot log in |
| `daily_sales_target` | numeric | |
| `commission_rate` | numeric | Percentage |
| `last_login` | timestamptz | |

**Constraints:** `UNIQUE(salon_id, phone)`, `UNIQUE(salon_id, email)` WHERE email IS NOT NULL.

**Roles and permissions:**

| Role | Can do |
|---|---|
| `owner` | Everything including backdate transactions (>today, ≤30 days ago) |
| `admin` | Same as owner |
| `manager` | Most operations, no system settings |
| `stylist` / `cashier` / `staff` | POS, clients, bookings |
| `viewer` | Read-only |

---

## workers

> **Frontend name: "Staff"** — these are the people who provide services (hairdressers, nail techs, etc.). They do **not** log in to the system.

Workers appear in the POS "Served By" dropdown, booking assignments, visit ratings, and the Staff Ledger report.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `salon_id` | uuid FK → salons | |
| `name` | varchar NOT NULL | |
| `phone` | varchar | |
| `job_title` | varchar | e.g. `Stylist`, `Nail Tech` |
| `hire_date` | date | |
| `is_active` | boolean | |

> **Key distinction:** `staff` table = login users (called "Users" in UI). `workers` table = service providers (called "Staff" in UI). A person can exist in both tables if they both log in and perform services. See [staff-vs-workers.md](./staff-vs-workers.md) for the full breakdown.

---

## sessions

Active login sessions.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `staff_id` | uuid FK → staff CASCADE | |
| `salon_id` | uuid FK → salons CASCADE | |
| `token` | varchar UNIQUE | Random hex string stored in `auth_token` cookie |
| `expires_at` | timestamptz | 30 days from login |

---

## clients

Salon customers. Tracked for loyalty, visit history, and SMS.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `salon_id` | uuid FK → salons CASCADE | |
| `name` | varchar NOT NULL | |
| `phone` | varchar NOT NULL | |
| `birthday` | date | Used for birthday SMS |
| `loyalty_points` | integer | Running balance |
| `total_visits` | integer | Denormalised counter |
| `total_spent` | numeric | Denormalised total (UGX) |
| `last_visit` | timestamptz | |
| `referred_by_client_id` | uuid FK → clients | Self-referencing |
| `referral_source_id` | uuid FK → referral_sources | |
| `is_active` | boolean | |
| `deleted_at` | timestamptz | Soft delete |

**Constraints:** `UNIQUE(salon_id, phone)`.

> `total_visits` and `total_spent` are updated in code when a visit is recorded. They can be resynced from visits with: `UPDATE clients SET total_spent = SUM(visits.total_amount), total_visits = COUNT(*) FROM visits WHERE visits.client_id = clients.id GROUP BY client_id`.

---

## visits

A completed checkout / service transaction.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `salon_id` | uuid FK → salons CASCADE | |
| `client_id` | uuid FK → clients RESTRICT | Cannot delete client with visits |
| `staff_id` | uuid FK → staff SET NULL | Who processed the sale |
| `worker_id` | uuid FK → workers SET NULL | Who served the client |
| `receipt_number` | varchar UNIQUE | e.g. `POSH-260511-7962` |
| `total_amount` | numeric NOT NULL | Full price before checkout discount |
| `amount_paid` | numeric NOT NULL DEFAULT 0 | Amount actually collected |
| `checkout_discount` | numeric NOT NULL DEFAULT 0 | One-time discount at checkout |
| `balance_due` | numeric NOT NULL DEFAULT 0 | Unpaid remainder |
| `payment_method` | varchar | `cash` / `mtn` / `airtel` |
| `payment_status` | varchar | `paid` / `partial` / `pending` |
| `points_earned` | integer | Loyalty points from this visit |
| `is_active` | boolean | False = soft-deleted |
| `deleted_at` / `deleted_by` | | Soft delete audit |
| `created_at` | timestamptz | Actual visit timestamp |
| `recorded_at` | timestamptz | When it was entered into system |

**Constraints (from migration 005):**
- `balance_due >= 0`
- `amount_paid >= 0`
- `checkout_discount >= 0`

**Index:** `idx_visits_balance_due ON visits(salon_id, balance_due) WHERE balance_due > 0` — fast query for clients with outstanding balances.

---

## visit_services

Line items for each visit.

| Column | Type | Notes |
|---|---|---|
| `visit_id` | uuid FK → visits CASCADE | |
| `service_id` | uuid FK → services RESTRICT | |
| `quantity` | integer DEFAULT 1 | |
| `unit_price` | numeric | Price per unit at time of sale |
| `price` | numeric | `unit_price × quantity` |
| `original_price` | numeric | Catalogue price before any discount |
| `discount_amount` | numeric DEFAULT 0 | Per-service discount |
| `discounted_by` | uuid FK → staff | Who authorised the discount |

---

## visit_addons

Add-on products purchased alongside a service.

| Column | Type | Notes |
|---|---|---|
| `visit_id` | uuid FK → visits CASCADE | |
| `addon_id` | uuid FK → service_addons RESTRICT | |
| `quantity` | integer CHECK > 0 | |
| `price_at_time` | numeric | Snapshot of price |

---

## services

Service catalogue.

| Column | Type | Notes |
|---|---|---|
| `price` | numeric NOT NULL | Stored as NUMERIC — always wrap in `Number()` in JS |
| `gender_target` | varchar | `all` / `male` / `female` |
| `category_id` | uuid FK → service_categories SET NULL | |
| `deleted_at` | timestamptz | Soft delete |

---

## service_addons

Optional extras that can be added to any service.

| Column | Type | Notes |
|---|---|---|
| `price` | numeric(12,0) CHECK >= 0 | |
| `sort_order` | integer | Display order |

---

## accounts

Cash and mobile money accounts for the salon.

| Column | Type | Notes |
|---|---|---|
| `type` | varchar | `cash` / `mtn_mobile_money` / `airtel_money` / `expense` |
| `is_system` | boolean | System accounts are auto-created and not deletable |

**View:** `account_balances` — aggregates `account_transactions` to compute current balance per account.

---

## account_transactions

Every money movement in or out of an account.

| Column | Type | Notes |
|---|---|---|
| `amount` | numeric(14,0) CHECK > 0 | Always positive |
| `direction` | varchar | `in` or `out` |
| `reference_type` | varchar | e.g. `visit`, `expense`, `advance` |
| `reference_id` | uuid | ID of the related record |

**Constraint:** `UNIQUE(salon_id, reference_id) WHERE reference_type = 'visit'` — prevents duplicate visit revenue entries. Balance payments use `ON CONFLICT DO UPDATE SET amount = amount + added`.

---

## expenses

Outgoing costs (rent, supplies, salaries, etc.).

| Column | Type | Notes |
|---|---|---|
| `amount` | numeric(12,2) CHECK >= 0 | |
| `expense_date` | date NOT NULL | |
| `payment_method` | varchar | `cash` / `mtn` / `airtel` |
| `deleted_at` | timestamptz | Soft delete |

---

## stock_items / stock_groups / stock_movements

Inventory management.

- `stock_groups` — categories for stock (e.g. Hair Products, Nail Supplies)
- `stock_items` — individual products with `current_qty` and `reorder_level`
- `stock_movements` — audit log of every quantity change (`qty_change` + `qty_after`)

**Constraint:** `UNIQUE(salon_id, name)` on both `stock_groups` and `stock_items`.

---

## bookings

Appointment bookings (future visits).

| Column | Type | Notes |
|---|---|---|
### `staff_id` | uuid FK → **workers** RESTRICT | Note: despite the column name, this references the `workers` table (frontend "Staff"), not the `staff` table |
| `client_id` | uuid FK → clients SET NULL | Null for guest bookings |
| `guest_name` / `guest_phone` | text | Used when client_id is null |
| `status` | varchar | `pending` / `confirmed` / `completed` / `cancelled` / `no_show` |

---

## staff_ratings

Post-visit ratings (1–5 stars). One per visit.

**Constraint:** `UNIQUE(visit_id)` — one rating per visit.  
Can link to either `staff_id` or `worker_id` (whoever served).

---

## message_templates

Reusable SMS/WhatsApp templates with variable substitution (`{clientName}`, `{salonName}`, etc.).

**Constraint:** `UNIQUE(salon_id, name)`.

---

## birthday_messages

Log of birthday SMS sent to clients. Prevents duplicate sends in the same year.

| Column | Notes |
|---|---|
| `year_sent` | Prevents re-sending the same year |

---

## referral_sources

Configurable list of how clients discovered the salon (Instagram, Google, Walk-in, etc.).

**Constraint:** `UNIQUE(salon_id, name)`.

---

## staff_advances

Cash advances given to staff, tracked for deduction.

| Column | Notes |
|---|---|
| `status` | `pending` / `deducted` / `cancelled` |

---

## Soft Deletes

Several tables use soft deletes rather than hard deletes. Always filter with:

```sql
WHERE is_active = true AND deleted_at IS NULL
```

Tables with soft delete: `clients`, `services`, `expenses`, `stock_items`, `visits`.
