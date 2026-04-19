# Salon System — Progress & Roadmap

_Last updated: 19 Apr 2026_

---

## ✅ Built & Working

| Area | Route | Notes |
|---|---|---|
| Authentication | `/login` | PIN + password, session cookies |
| Dashboard | `/dashboard` | Today's stats, recent visits, quick actions |
| POS | `/pos` | Client search (debounced), service selection, worker autocomplete, payment recording |
| Clients | `/clients` | List, search, add/edit |
| Services | `/services` | Full CRUD, gender targeting |
| Categories | `/categories` | Full CRUD, used in POS and services |
| Sales History | `/sales` | Transaction list with filters |
| Workers | `/workers` | Team tab (search/filter) + Performance tab (ledger, revenue, ratings) |
| User Management | `/staff` | System login accounts, roles, PIN reset |
| Loyalty Overview | `/loyalty` | Points and tier overview per client |
| SMS Settings | `/sms` | Receipt template editor + test send |

---

## ❌ Missing / Not Yet Built

### 1. Salon Settings Page (`/settings`) — **High Priority**
- Edit salon name, logo, brand colors
- Business hours
- Contact info (phone, address, email)
- Currently the branding lives in the DB but there is no UI to update it

### 2. Reports & Analytics (`/reports`) — **High Priority**
- Revenue over time (daily, weekly, monthly charts)
- Top services by revenue/volume
- Top clients by spend
- Date range comparisons
- Export to CSV / PDF
- Dashboard currently only shows today

### 3. Loyalty Configuration — **Medium Priority**
- UI to set point earn rate (e.g. 1 point per UGX 1,000)
- Tier thresholds (Bronze / Silver / Gold)
- Redemption value (e.g. 100 points = UGX 5,000 discount)
- Currently rules appear to be hardcoded

### 4. Client Visit History — **Medium Priority**
- From a client profile, view their full visit/service history
- See what services they've had, how much spent, which worker served them

### 5. Receipt / Invoice Printing — **Medium Priority**
- Generate a printable or PDF receipt after a POS transaction
- Could also support email receipt via Resend (already in the stack)

### 6. Appointment / Booking (`/appointments`) — **Lower Priority**
- Schedule future appointments with date + time
- Currently the system is walk-in / POS only

### 7. Expense Tracking — **Lower Priority**
- Log business expenses (rent, supplies, staff salaries)
- Calculate actual profit = revenue − expenses
- Tie into reports

### 8. Inventory / Products — **Lower Priority**
- Manage retail products sold at the salon (shampoos, nail products, etc.)
- Stock levels, low-stock alerts, product sales in POS

### 9. Payment Integration — **Lower Priority**
- Actual MTN / Airtel Mobile Money API integration
- Currently payment method is manually recorded, not processed

---

## Suggested Next Steps (by impact)

1. **Salon Settings** — needed for every new salon onboarding
2. **Reports/Analytics** — biggest business value for owners
3. **Client Visit History** — commonly requested at the desk
4. **Loyalty Configuration** — make rules editable instead of hardcoded
5. **Receipt Printing** — polish for the POS flow
