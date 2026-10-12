# Tasks

Current phase: **Phase 1 — Foundation**. Phases and the long view are in [roadmap.md](roadmap.md).

Tick a task when it is built and checked in the browser. Add new tasks under the phase they belong to; move finished phases to the bottom.

## Decisions

Made 2026-10-12:

- Database: MySQL/MariaDB is final (not PostgreSQL).
- Role names stay as they are: `student`, `instructor`, `admin`. Other roles are created as data.
- Forms: shadcn fields with server actions; Zod is mandatory for validation. React Hook Form may be added where a form needs it.
- Email: console logging only for now.
- Storage: Cloudflare R2, through its S3-compatible API (Phase 2 media).
- Packages are installed with the pnpm CLI (`pnpm add`, `pnpm dlx shadcn add`), never by editing `package.json` by hand.

Still open:

- [ ] Payment provider (spec says Stripe) — needed for Phase 5.
- [ ] Email provider — needed before production.

## Phase 1 — to do

### Housekeeping

- [ ] Unstage `.idea/` and add it to `.gitignore`.
- [x] Delete `src/components/example.tsx` if unused.

### Auth

- [x] Forgot-password and reset-password pages and actions.
- [x] 2FA sign-in step (login currently answers "Two-factor sign-in is not available yet").
- [x] 2FA setup and disable in account settings (TOTP + backup codes).
- [x] Email verification: unverified users may sign in and see a "verify your email" banner with a resend button; `/verify-email` landing page.
- [x] Rate limiting on login, sign-up and reset.

### RBAC

- [x] Define the permission key list in one place (`src/lib/permissions.ts`); Phase 1 keys only, later modules add theirs.
- [x] Seed the permission list; `instructor` and `student` get their default permissions (`admin` is the superuser and needs none).
- [x] Call `requirePermission` / `authorizeAction` in every admin page and action; nav items and buttons are filtered by permission.
- [x] Friendly "no access" page instead of the thrown `Forbidden` error.

### Users, roles and permissions (admin)

- [x] `/admin/users`: list with search, role and status filters, server-side pagination.
- [x] Create and edit a user; change role; suspend, ban, reactivate.
- [x] `/admin/users/roles`: create, rename and delete roles (reserved roles protected).
- [x] Permission matrix: roles × permissions with checkboxes.

### Activity log

- [x] `ActivityLog` model: user, action, entity, entity ID, details, timestamp.
- [x] `logActivity` helper in `src/services/activity.ts`, called from sign-in/out, failed sign-ins, password and 2FA changes, and user, role and permission changes.
- [x] `/admin/activity-logs`: list with search and filters.

### Admin shell

- [x] Rebuild `admin-nav.ts` to the spec's information architecture (§4): Website, Courses, Learners, Commerce, Forms, Analytics, Marketing, SEO, Blog, Media, Users, Settings, Activity Logs. Remove "WooCommerce" and other mockup labels.
- [x] Sidebar width 240–260px, collapsing to an icon rail of 68–72px on desktop; top bar 64–72px.
- [x] Shared admin building blocks: page header, data table (sort, filter, pagination), status badge, confirm dialog, toast, empty / loading / error states.
- [x] `loading.tsx`, `error.tsx` and `not-found.tsx` for the admin panel.

### Dashboard

- [x] Replace the placeholder with database-backed widgets available now: user counts by role, new sign-ups, recent activity.
- [x] Date range filter (Today, 7 Days, 30 Days, ... per §6), ready for the later revenue and course widgets.

### Quality

- [x] Vitest set up (`pnpm test`) with unit tests for `parseDateRange` and `panelForRole` / `panelHome` (`tests/unit/`).
- End-to-end tests: deliberately not included, by the owner's decision.
- [ ] Browser check of the admin shell at mobile, tablet and desktop widths, to be done by hand.
- [ ] Browser check, by hand, of what was never run in a browser: two-factor setup (QR, backup codes, verify, redirect back with "Two-factor authentication is on"), the code input on `/two-factor`, confirm dialogs and toasts, keyboard use of the permission matrix.

### Known issues

- [ ] "No access" and not-found pages inside the admin panel show the right content but answer HTTP 200, because `src/app/(admin)/loading.tsx` starts streaming before the permission check. A fix means moving the loading boundary into each route segment (or a `proxy.ts` permission map).
- [ ] Nothing calls `pruneRateLimits`; old `rate_limit` rows are only overwritten when their key is hit again.
- [ ] The user detail page lists activity done by the user, not actions done to them.

## Done

- [x] Next.js 16 app with `src/` layout, Tailwind 4, shadcn/ui on Base UI.
- [x] Prisma 7 with the MariaDB adapter; `init` migration applied; db scripts in `package.json`.
- [x] Models: `User` (with status), `Role`, `Permission`, `RolePermission`, plus Better Auth's `Session`, `Account`, `Verification`, `TwoFactor`.
- [x] Better Auth: email + password, sign-up as `student`, suspended/banned accounts refused a session, two-factor plugin installed.
- [x] Login, sign-up and logout through server actions; redirect to the panel for the user's role.
- [x] `getCurrentUser`, `requireUser`, `can`, `requirePermission` in `src/services/user.ts`.
- [x] Seed: `student`, `instructor`, `admin` roles and the first admin user from env variables.
- [x] Admin shell: guarded layout, sidebar, placeholder dashboard.
- [x] Student panel: dashboard, my courses, certificates, offers, notifications (sample data), profile and settings (real).
- [x] Public site: home, courses, course detail, hot deals, blog, about, contact, cart (cookie), checkout (no payment) — sample data.
- [x] TypeScript and ESLint pass.
