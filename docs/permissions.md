# Roles & Permissions

This document defines the role-based access control (RBAC) system for the Salon Management System. All API routes enforce these permissions at the application layer.

## Roles

The system has 5 core roles:

| Role | Description |
|------|-------------|
| **owner** | Account owner with full system access. Can manage branches, staff assignments, and global settings. |
| **admin** | Administrative user with full feature access except branch management and staff role assignments above staff level. |
| **manager** | Middle management role. Can manage services, clients, expenses, and view reports, but cannot manage staff or change settings. |
| **staff** | Day-to-day operations. Can record POS sales, create bookings, add clients, and view data. Cannot modify system configuration. |
| **viewer** | Read-only access to dashboards and reports. Cannot create, edit, or delete any data. |

## Permissions Matrix

### Core Permissions

| Feature | Owner | Admin | Manager | Staff | Viewer |
|---------|-------|-------|---------|-------|--------|
| **Dashboard & Reports** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **POS/Sales** | | | | | |
| — Record sales | ✓ | ✓ | ✓ | ✓ | ✗ |
| — Record balance payments | ✓ | ✓ | ✓ | ✓ | ✗ |
| — Edit same-day sales | ✓ | ✓ | ✗ | ✗ | ✗ |
| — Void/delete sales | ✓ | ✓ | ✗ | ✗ | ✗ |
| — Backdate transactions | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Clients** | | | | | |
| — View clients | ✓ | ✓ | ✓ | ✓ | ✓ |
| — Create clients | ✓ | ✓ | ✓ | ✓ | ✗ |
| — Edit clients | ✓ | ✓ | ✓ | ✓ | ✗ |
| — Delete clients | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Services & Categories** | | | | | |
| — View services | ✓ | ✓ | ✓ | ✓ | ✓ |
| — Create services | ✓ | ✓ | ✓ | ✗ | ✗ |
| — Edit services | ✓ | ✓ | ✓ | ✗ | ✗ |
| — Delete services | ✓ | ✓ | ✓ | ✗ | ✗ |
| — Manage categories | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Bookings** | | | | | |
| — View bookings | ✓ | ✓ | ✓ | ✓ | ✓ |
| — Create bookings | ✓ | ✓ | ✓ | ✓ | ✗ |
| — Update bookings | ✓ | ✓ | ✓ | ✓ | ✗ |
| — Reschedule bookings | ✓ | ✓ | ✓ | ✓ | ✗ |
| — Cancel bookings | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Staff Management** | | | | | |
| — View staff | ✓ | ✓ | ✗ | ✗ | ✗ |
| — Create staff | ✓ | ✓ | ✗ | ✗ | ✗ |
| — Edit staff | ✓ | ✓ | ✗ | ✗ | ✗ |
| — Delete staff | ✓ | ✗ | ✗ | ✗ | ✗ |
| — Assign roles | ✓ | ✓* | ✗ | ✗ | ✗ |
| **Workers (Stylists)** | | | | | |
| — View workers | ✓ | ✓ | ✓ | ✗ | ✗ |
| — Create workers | ✓ | ✓ | ✗ | ✗ | ✗ |
| — Edit workers | ✓ | ✓ | ✗ | ✗ | ✗ |
| — Delete workers | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Expenses** | | | | | |
| — View expenses | ✓ | ✓ | ✓ | ✓ | ✓ |
| — Create expenses | ✓ | ✓ | ✓ | ✓ | ✗ |
| — Edit expenses | ✓ | ✓ | ✓ | ✓ | ✗ |
| — Delete expenses | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Inventory** | | | | | |
| — View inventory | ✓ | ✓ | ✓ | ✓ | ✓ |
| — Create items | ✓ | ✓ | ✓ | ✗ | ✗ |
| — Edit items | ✓ | ✓ | ✓ | ✗ | ✗ |
| — Delete items | ✓ | ✓ | ✓ | ✗ | ✗ |
| — Record movements | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Accounts & Transactions** | | | | | |
| — View accounts | ✓ | ✓ | ✓ | ✓ | ✓ |
| — Create accounts | ✓ | ✓ | ✓ | ✗ | ✗ |
| — Edit accounts | ✓ | ✓ | ✓ | ✗ | ✗ |
| **SMS & Communications** | | | | | |
| — Send SMS | ✓ | ✓ | ✓ | ✗ | ✗ |
| **System Settings** | | | | | |
| — Edit settings | ✓ | ✓ | ✗ | ✗ | ✗ |
| — View settings | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Branch Management** | | | | | |
| — Create branches | ✓ | ✗ | ✗ | ✗ | ✗ |
| — Edit branches | ✓ | ✗ | ✗ | ✗ | ✗ |
| — View branches | ✓ | ✓ | ✓ | ✓ | ✓ |

\* Admin can only assign staff and viewer roles. Only owner can assign admin or manager roles.

## Role Assignment Rules

- **Owner** can assign any role (admin, manager, staff, viewer)
- **Admin** can assign staff or viewer roles only
- **Manager** cannot assign any roles
- **Staff** cannot assign any roles
- **Viewer** cannot assign any roles
- **No one** can assign the owner role

## Data Isolation by Role

### Branch Scoping
- **Owner** (with `branch_id=null`) sees all salon data across all branches
- **Owner** (with assigned `branch_id`) sees only that branch's data
- **Admin** sees only assigned branch data
- **Manager** sees only assigned branch data
- **Staff** sees only assigned branch data
- **Viewer** sees only assigned branch data

### Shared Data (Not Branch-Scoped)
- Clients (belong to salon, not specific branch)
- Services & Categories (belong to salon, not specific branch)
- Addons (belong to salon, not specific branch)

### Branch-Scoped Data
- Bookings
- Visits/Sales
- Expenses
- Workers/Staff
- Inventory

## API Endpoint Protection

All API routes require authentication. Permission checks are enforced at the endpoint level using the user's role:

```javascript
// Example: Only owner, admin, and manager can edit services
if (!['owner', 'admin', 'manager'].includes(user.role)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Delete Restrictions

All delete operations are restricted to **owner, admin, or manager** unless noted otherwise. Staff and viewer roles cannot delete any records.

| Endpoint | Allowed Roles | Notes |
|----------|--------------|-------|
| `DELETE /api/visits/[id]` | owner, admin | Voiding sales is highly sensitive |
| `DELETE /api/workers` | owner | Only account owner can remove workers |
| `DELETE /api/branches/[id]` | owner | Only account owner can remove branches |
| `DELETE /api/services/[id]` | owner, admin, manager | |
| `DELETE /api/clients/[id]` | owner, admin, manager | |
| `DELETE /api/bookings/[id]` | owner, admin, manager | Cancels the booking |
| `DELETE /api/expenses/[id]` | owner, admin, manager | |
| `DELETE /api/expense-categories/[id]` | owner, admin, manager | |
| `DELETE /api/inventory/items/[id]` | owner, admin, manager | |
| `DELETE /api/inventory/groups/[id]` | owner, admin, manager | |
| `DELETE /api/addons/[id]` | owner, admin, manager | |
| `DELETE /api/referral-sources/[id]` | owner, admin, manager | |

### Other Critical Endpoints

- `PUT /api/services/[id]` — Requires owner, admin, or manager
- `POST /api/visits` — Blocked for viewer
- `PATCH /api/visits/[id]` — Blocked for viewer (balance payments)
- `PUT /api/visits/[id]` — Requires owner or admin (same-day edit)
- `PUT /api/clients/[id]` — Blocked for viewer
- `POST /api/bookings` — Blocked for viewer
- `PATCH /api/bookings/[id]` — Blocked for viewer

## Frontend Implementation

### Navigation Visibility

Pages are hidden from the sidebar and command palette (Ctrl+K) when the user's role has no access:

| Page | Owner | Admin | Manager | Staff | Viewer |
|------|-------|-------|---------|-------|--------|
| Users (`/staff`) | Visible | Visible | Hidden | Hidden | Hidden |
| Workers (`/workers`) | Visible | Visible | Visible | Hidden | Hidden |
| Accounts | Visible | Visible | Hidden | Hidden | Hidden |
| POS (New Sale) | Visible | Visible | Visible | Visible | Hidden |
| Add-ons | Visible | Visible | Visible | Hidden | Hidden |
| All other pages | Visible | Visible | Visible | Visible | Visible |

Pages like Services, Inventory, and Expenses remain visible to all roles since they support read-only viewing. The API blocks any unauthorized write attempts.

### UI Element Hiding

Frontend pages also hide action buttons (edit, delete, create) based on role:

```javascript
const canEdit = ['owner', 'admin'].includes(user.role);
```

However, the **API is the authoritative security boundary**. Frontend hiding is only for UX; unauthorized roles cannot perform actions via direct API calls.

## Audit Trail

All writes to critical tables are logged in `branch_audit_logs`:
- Staff management
- Service changes
- Client deletions
- Sales voids
- Account transactions

The `recorded_by`, `deleted_by`, `voided_by`, and `edited_by` fields track which user performed each action.

## Session Management

- Sessions expire after 30 days
- Failed login attempts lock account for 15 minutes (after 5 failures)
- Logout destroys the session immediately
- Role is fetched fresh on each request from the staff record

## See Also

- [API Endpoints](./api-endpoints.md) — Complete endpoint reference
- [Staff vs Workers](./staff-vs-workers.md) — Difference between staff (users) and workers (service providers)
