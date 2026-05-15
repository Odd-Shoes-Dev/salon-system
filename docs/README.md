# Developer Documentation

Reference docs for the Salon Management System.

| File | Description |
|---|---|
| [architecture.md](./architecture.md) | Tech stack, project layout, multi-tenancy, auth flow, Neon patterns |
| [database-schema.md](./database-schema.md) | All tables, columns, constraints, relationships |
| [api-endpoints.md](./api-endpoints.md) | Every API route, request/response shape, side effects |
| [staff-vs-workers.md](./staff-vs-workers.md) | Critical distinction: `workers` table = "Staff" in UI; `staff` table = "Users" in UI |
| [environment-variables.md](./environment-variables.md) | All env vars, what they do, `.env.local` template |
| [domain-routing.md](./domain-routing.md) | URL convention, ROOT_DOMAIN env var, safety redirects, DNS setup |
| [neon-and-imagekit.md](./neon-and-imagekit.md) | Neon DB setup and ImageKit configuration details |
