# Staff (workers table) vs Users (staff table)

This is one of the most important — and most confusing — distinctions in the codebase.

> **The naming is intentionally flipped between the database and the frontend UI.**

| | `workers` table | `staff` table |
|---|---|---|
| **Called in the UI** | **"Staff"** | **"Users"** |
| **Log in to the system?** | ❌ No | ✅ Yes |
| **Have a role / PIN?** | ❌ No | ✅ Yes |
| **Appear in POS "Served By"?** | ✅ Yes | ❌ No |
| **Appear in bookings?** | ✅ Yes | ❌ No |
| **Get visit ratings?** | ✅ Yes | ❌ No |
| **Staff Ledger report?** | ✅ Yes | ❌ No |

---

## `workers` table — "Staff" in the Frontend

In the UI, these people are shown under the **Staff** section. They are the service providers — hairdressers, nail technicians, masseuses, etc. They do **not** log in.

Workers appear in:
- **POS checkout** — "Served By" dropdown
- **Bookings** — the staff member assigned to an appointment
- **Staff schedules** — weekly availability for booking slots
- **Visit ratings** — clients rate the person who served them
- **Staff Ledger** — revenue, visit count, and average rating (via `/api/workers/ledger`)

A `workers` record has only `name`, `phone`, `job_title`, and `hire_date` — no PIN, no role, no sessions.

---

## `staff` table — "Users" in the Frontend

In the UI, these people are shown under the **Users** or **Accounts** section. They are the people who **log into and operate the management system**.

A `staff` record has:
- `pin_hash` — bcrypt hash of a 4-digit PIN used to authenticate
- `role` — controls what they can see and do
- `sessions` — active login tokens

Creating a `staff` record gives someone access to the dashboard, POS, reports, and settings.

**Roles:**

| Role | Access Level |
|---|---|
| `owner` | Full access, can backdate transactions |
| `admin` | Same as owner |
| `manager` | Operational access, cannot change system settings |
| `stylist` / `cashier` / `staff` | POS, clients, basic operations |
| `viewer` | Read-only access |

---

## Can the Same Person Be in Both Tables?

Yes. A senior stylist who both **provides services** and **manages the system** should have:
- A `workers` record — so they appear in the POS "Served By" dropdown and bookings
- A `staff` record — so they can log in and access management features

These are two separate rows in two separate tables with no automatic link between them.

---

## Common Confusion Points

**Why doesn't the POS show "Users" (staff table) in "Served By"?**  
Because "Served By" reads from the `workers` table. If a person only has a `staff` (user) record, they won't appear in the POS dropdown — they need a `workers` record too.

**Why do ratings go to a workers record, not a staff record?**  
Ratings track service quality. The person a client rates is the one who performed the service — that's always a `workers` record.

**The `visits` table has both `staff_id` and `worker_id` — what's the difference?**  
- `visits.staff_id` → the `staff` (user) who **processed the sale** at the POS
- `visits.worker_id` → the `workers` (staff) member who **performed the service**

---

## Quick Reference: Which Table to Query

| Use case | Table |
|---|---|
| Authenticate a login | `staff` + `sessions` |
| "Who processed this sale?" | `staff` (via `visits.staff_id`) |
| "Who served this client?" | `workers` (via `visits.worker_id`) |
| POS "Served By" dropdown | `workers` |
| Booking assignment | `workers` |
| Staff availability schedule | `workers` (via `staff_schedules.staff_id → workers.id`) |
| Visit rating | `workers` |
| Revenue per stylist | `workers` ledger (`/api/workers/ledger`) |
| Change someone's login role | `staff` |
| Deactivate a login | `staff.is_active = false` |
| Remove someone from POS/bookings | `workers.is_active = false` |
