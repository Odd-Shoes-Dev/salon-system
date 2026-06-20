# Search Bar Expansion Plan

## Current State

The command palette (`src/components/CommandPalette.tsx`) is a page-navigation tool.
It matches against a static list of `NAV_ITEMS` — each item has a `label`, `description`, `href`, and `keywords` array.

Trigger: `Ctrl K` or the Search button in the top nav (`SalonBranding.tsx`).

**Pages currently indexed:**
| Label | Route | Notes |
|---|---|---|
| Dashboard | `/dashboard` | |
| Point of Sale | `/pos` | |
| Bookings | `/bookings` | |
| Sales | `/sales` | |
| Clients | `/clients` | |
| Birthdays | `/birthdays` | |
| Services | `/services` | |
| Inventory | `/inventory` | |
| Reports | `/reports` | |
| Accounts | `/accounts` | |
| Expenses | `/expenses` | |
| Add-ons | `/addons` | |
| Staff | `/workers` | Salon staff (stylists, etc.) |
| Users | `/staff` | System users with login access |
| Settings | `/settings` | |

---

## Planned Expansion

The goal is to evolve the palette from pure page navigation into a full in-app search — so users can jump directly to sub-sections, specific records, or named settings without knowing which page they live on.

Results will be grouped by type (pages, staff, settings, etc.) and shown under section headers inside the palette.

---

### 1. Sub-page / Deep-link Results

Static entries that link to specific sections within a page rather than the page root.

**Settings sub-pages:**
| Search term | Destination | Description |
|---|---|---|
| branding, logo, colours, theme | `/settings?tab=branding` | Salon branding & theme colour |
| SMS, messages, notifications | `/settings?tab=sms` | SMS configuration |
| branches, locations | `/settings?tab=branches` | Manage branches |

**Reports sub-pages:**
| Search term | Destination | Description |
|---|---|---|
| staff ledger, worker performance, commissions | `/reports?tab=ledger` | Per-staff revenue ledger |
| revenue, income, daily report | `/reports?tab=revenue` | Revenue breakdown |

**Staff quick-actions:**
| Search term | Destination | Description |
|---|---|---|
| add staff, new worker | `/workers?new=true` | Open add-staff form |
| add user, new user | `/staff?new=true` | Open add-user form |

These are just additional `NAV_ITEMS` entries with deep-link `href` values — no API needed.

---

### 2. Live Record Search

Dynamically fetch real records from the database and surface them in the palette as a second result group, shown below the static page results.

**Priority order for implementation:**

#### Staff (`/api/workers?active=true`)
- Search by name or job title
- Result label: staff member's name + job title chip
- Action: navigate to `/workers?highlight={id}` or open their edit panel

#### Clients (`/api/clients?search={query}`)
- Search by name or phone
- Result label: client name + last visit date
- Action: navigate to `/clients/{id}`

#### Branches (`/api/branches`)
- Search by branch name
- Result label: branch name + city/location if stored
- Action: switch to that branch context via `/api/auth/switch-branch`

#### Services (`/api/services?search={query}`)
- Search by service name or category
- Action: navigate to `/services?highlight={id}`

#### Receipts / Sales (`/api/visits?receipt={query}`)
- Search by receipt number or client name
- Action: navigate to `/sales` and open that transaction

---

### 3. Implementation Notes (for when ready)

**Architecture approach:**
- Keep static `NAV_ITEMS` as the first result group (always instant)
- Add a `useDebouncedSearch(query, 300)` hook that fires API calls once the query is ≥ 2 characters
- Show a loading spinner in the palette while the API responds
- Render results in grouped sections with a section header label (e.g., "Pages", "Staff", "Clients")

**API endpoints needed:**
- `GET /api/workers?search={q}&active=true` — already exists, add `search` param
- `GET /api/clients?search={q}&limit=5` — already exists
- `GET /api/branches` — already exists
- `GET /api/services?search={q}&limit=5` — check if search param exists, add if not
- `GET /api/visits?receipt={q}&limit=5` — new param on existing route

**Keyboard nav:** Arrow keys must move across both static and dynamic groups seamlessly.

**Empty states:** If query ≥ 2 chars and no dynamic results, show "No records found" only in the dynamic section — not the whole palette.

**Debounce:** 300 ms debounce on the dynamic fetch to avoid hammering the API on every keystroke.

---

### 4. Result Item Types (UI)

Each result type gets a distinct visual treatment to help users scan quickly:

```
[page icon]   Dashboard                    → PAGE chip
              Overview, stats & quick actions

[person icon] Maria Njeri  · Stylist        → STAFF chip
              Last seen: 12 Jun 2026

[client icon] Jane Wanjiku  · 0712 345 678  → CLIENT chip
              Last visit: 3 days ago

[receipt icon] RCP-00142  · Jane Wanjiku    → RECEIPT chip
               Ksh 2,400 · 18 Jun 2026
```

Chips are small coloured badges (e.g., grey for PAGE, blue for STAFF, green for CLIENT) so the user knows the category at a glance.

---

## Files to Touch When Implementing

| File | Change |
|---|---|
| `src/components/CommandPalette.tsx` | Add dynamic search groups, debounce hook, section headers |
| `src/app/api/workers/route.ts` | Ensure `?search=` param is supported |
| `src/app/api/clients/route.ts` | Ensure `?search=` param is supported |
| `src/app/api/services/route.ts` | Add `?search=` param if missing |
| `src/app/api/visits/route.ts` | Add `?receipt=` or `?search=` param for receipt lookup |
| `src/app/api/branches/route.ts` | Already returns all branches — no change needed |
