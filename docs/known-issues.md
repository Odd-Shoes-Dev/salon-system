# Known Issues / Tech Debt

Things we know about but have deliberately deferred. Not urgent enough to stop and fix the moment they're found, but real enough to track instead of forgetting.

---

## 1. Neon date/time columns come back as JS `Date` objects — recurring bug

**The footgun:** Postgres `date`, `time`, and `timestamptz` columns are returned by the Neon serverless driver as native JS `Date` objects, not strings — *unless* the query explicitly casts the column with `::text`. Any code downstream that treats the value as a string breaks in one of two ways:

- `.split('-')` / `.slice(0, 5)` on a `Date` object → `TypeError: x.split is not a function` (hard crash)
- String concatenation like `value + 'T12:00:00'` on a `Date` object → silently produces garbage (`new Date(...)` on it → `"Invalid Date"`, no crash, just wrong output)

**Why it keeps recurring:** there's no enforcement. Every new query that selects a date/time column has to remember to add `::text` by hand — easy to copy an existing query, add a new date column, and forget. Confirmed hit so far:

- `salon-booking`'s reschedule and cancel routes (`booking_date`/`start_time`) — crashed with `bookingDate.split is not a function`
- This repo's `balance-sheet` and `balance-sheet/liabilities` routes (`due_date`) — rendered as "Invalid Date" in the Liabilities tab
- **Not yet reported broken, but has the same unguarded pattern:** `inventory/payables` (`due_date` is selected without `::text`) — worth checking next time anyone touches that page

**Direction for a real fix (not yet built):** the current mitigation is "remember to cast every time," which has already failed repeatedly. Options, roughly in order of robustness:

1. A thin wrapper around `sql` that walks returned rows and stringifies any `Date` value before handing them back — fixes every existing *and future* query without touching call sites. Most robust, but needs care around genuinely-wanted `Date` objects (e.g. anywhere code already does `new Date(row.created_at)` on purpose).
2. A lint rule or small codemod that flags a `SELECT` of a known date/time column without `::text`.
3. Keep relying on each developer remembering — already proven not to work; listed only for completeness.

Pick a direction and build it — this doc exists so the decision isn't lost between sessions.

---

## 2. No rate limiting on salon-booking's booking lookup/cancel/reschedule

Lives in the `salon-booking` repo, not this one — documented in [`salon-booking/docs/known-issues.md`](../../salon-booking/docs/known-issues.md). Noted here too since it's the kind of cross-cutting risk worth knowing about from either repo.
