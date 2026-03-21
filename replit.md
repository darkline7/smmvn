# SMM Panel Pro

## Overview

Full-stack Social Media Marketing panel with user dashboard, admin panel, API v2, and complete order management system.

## Recent Improvements (March 2026)

- **Orders page**: Full Vietnamese language consistency, server-side pagination with URL state persistence, VND price display alongside USD
- **Sidebar**: Added prominent "Tạo đơn hàng mới" CTA button, real unread notification badge counts from API
- **Dashboard chart**: Replaced custom div bar chart with proper Recharts AreaChart with tooltip (VND + USD) and grid
- **Topbar**: Dynamic page titles from route-name mapping (human-readable Vietnamese) instead of raw URL slugs
- **Notification dot**: Real unread count from `/api/notifications` instead of always-visible hardcoded dot
- **Router**: Registered missing `/subscriptions` route (`subscriptions.tsx` page was orphaned)
- **Admin nav**: Translated "Users" sidebar label to Vietnamese ("Người dùng")

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn/ui
- **Data fetching**: TanStack React Query (generated hooks)
- **Charts**: Recharts
- **Forms**: react-hook-form + @hookform/resolvers
- **Animations**: framer-motion
- **Build**: esbuild (API server CJS bundle)

## Architecture

### Session Management
The API server uses an in-memory session store (Map) with cookie-based sessions (`sid` cookie). Session functions `setSession()` and `getSession()` are exported from `artifacts/api-server/src/app.ts`.

### Authentication
- Session cookie auth for web users
- API key auth for public API v2 (`/api/v2` endpoint)
- Admin: uses session + role check (`requireAdmin` middleware)

### Demo Credentials
- Admin: `admin@smmpanel.com` / `password` → role: admin
- Demo User: `demo@smmpanel.com` / `password` → role: user, balance: $50

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   │   └── src/
│   │       ├── app.ts       # Express app + session middleware
│   │       ├── lib/auth.ts  # Auth helpers (requireAuth, requireAdmin, etc.)
│   │       └── routes/
│   │           ├── auth.ts       # /api/auth/*
│   │           ├── profile.ts    # /api/profile
│   │           ├── services.ts   # /api/services, /api/categories
│   │           ├── orders.ts     # /api/orders
│   │           ├── wallet.ts     # /api/wallet/*
│   │           ├── tickets.ts    # /api/tickets
│   │           ├── dashboard.ts  # /api/dashboard/*
│   │           ├── misc.ts       # /api/announcements, /api/notifications, /api/referrals
│   │           ├── admin.ts      # /api/admin/* (all admin routes)
│   │           └── apiv2.ts      # /api/v2 (public API v2)
│   └── smm-panel/          # React + Vite frontend
│       └── src/
│           ├── pages/       # All page components
│           │   ├── public/  # Landing, services, api-docs pages
│           │   ├── auth/    # Login, register pages
│           │   ├── dashboard/ # User dashboard pages
│           │   └── admin/   # Admin panel pages
│           ├── components/  # Shared UI components
│           └── App.tsx      # Root app with routing
├── lib/
│   ├── api-spec/            # OpenAPI 3.1 spec + Orval codegen config
│   ├── api-client-react/    # Generated React Query hooks
│   ├── api-zod/             # Generated Zod schemas
│   └── db/
│       └── src/schema/
│           ├── users.ts
│           ├── categories.ts
│           ├── services.ts
│           ├── providers.ts
│           ├── orders.ts
│           ├── transactions.ts
│           ├── tickets.ts
│           └── misc.ts      # announcements, notifications, referrals, settings, api logs
```

## Pages

### Public
- `/` - Landing page
- `/services` - Service catalog
- `/api-docs` - API v2 documentation
- `/pricing` - Pricing page
- `/faq` - FAQ
- `/login`, `/register`, `/forgot-password`

### User Dashboard (requires auth)
- `/dashboard` - Stats + chart + recent orders
- `/new-order` - Order form with service picker + real-time price calc
- `/orders` - Order list with filters, refill/cancel
- `/mass-order` - Bulk order textarea
- `/subscriptions` - Manage subscriptions
- `/drip-feed` - Drip-feed orders
- `/services` - Browse services
- `/add-funds` - Deposit page (bank transfer, QR)
- `/transactions` - Transaction history
- `/tickets` - Support tickets
- `/api` - API key management + code examples
- `/profile` - Profile settings
- `/referrals` - Referral program
- `/notifications` - Notifications

### Admin Panel (requires admin role)
- `/admin` - Admin dashboard
- `/admin/users` - User management
- `/admin/orders` - Order management
- `/admin/services` - Service CRUD
- `/admin/categories` - Category CRUD
- `/admin/providers` - Provider management (test/sync)
- `/admin/payments` - Deposit approvals
- `/admin/tickets` - Ticket management
- `/admin/announcements` - Announcements
- `/admin/api-logs` - API request logs
- `/admin/settings` - Site settings

## API v2

Public endpoint: `POST /api/v2`

Actions: `services`, `add`, `status`, `multiple_status`, `balance`, `refill`, `refill_status`, `cancel`

Auth: `key` parameter (API key from user profile)

Rate limit: 120 requests/minute per IP

## Security Architecture

Full audit completed 2026-03-14. See `SECURITY_AUDIT_REPORT.md` for details.

### Password Hashing
- **New users:** bcryptjs (cost factor 12) — each password has its own random salt
- **Migration:** Legacy SHA-256 users verified and silently upgraded to bcrypt on next login
- Max password length: 128 characters (DoS prevention)

### Race Condition Protection
All balance-modifying operations use DB transactions:
- `POST /orders` — single order
- `POST /orders/mass` — mass order
- `POST /api/v2` (action: add) — API v2 order
- `POST /admin/users/:id/balance` — admin balance adjustment
- `POST /admin/payments/:id/approve` — deposit approval

### Input Validation
- Admin role changes: validated enum `["user","admin","reseller"]`
- Order/ticket status: validated enum
- Services/categories: explicit field whitelist (no mass assignment)
- Admin order PATCH: validated status enum

### Timing Attack Protections
- Cron secret: `crypto.timingSafeEqual` comparison
- Legacy password comparison: `crypto.timingSafeEqual`

### Rate Limiting
- Auth endpoints: 20 requests/15 minutes
- API v2: 120 requests/minute
- Global: 300 requests/minute

## Database Operations

- Push schema: `pnpm --filter @workspace/db run push`
- Force push: `pnpm --filter @workspace/db run push-force`

## Codegen

Run after OpenAPI spec changes: `pnpm --filter @workspace/api-spec run codegen`
