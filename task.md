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
- [ ] Delete `src/components/example.tsx` if unused.

### Auth

- [ ] Forgot-password and reset-password pages and actions.
- [ ] 2FA sign-in step (login currently answers "Two-factor sign-in is not available yet").
- [ ] 2FA setup and disable in account settings (TOTP + backup codes).
- [ ] Email verification: decide whether unverified users may sign in; add the "verify your email" screen.
- [ ] Rate limiting on login, sign-up and reset.

### RBAC

- [ ] Define the permission key list (`page.view`, `course.publish`, `order.refund`, `user.manage`, `settings.manage`, ... per spec §22) in one place.
- [ ] Seed the permission list; `instructor` and `student` get their default permissions (`admin` is the superuser and needs none).
- [ ] Call `requirePermission` in every admin action and service; hide nav items and buttons the user lacks permission for.
- [ ] Friendly "no access" page instead of the thrown `Forbidden` error.

### Users, roles and permissions (admin)

- [ ] `/admin/users`: list with search, role and status filters, server-side pagination.
- [ ] Create and edit a user; change role; suspend, ban, reactivate.
- [ ] `/admin/users/roles`: create, rename and delete roles (reserved roles protected).
- [ ] Permission matrix: roles × permissions with checkboxes.

### Activity log

- [ ] `ActivityLog` model: user, action, entity, entity ID, details, timestamp.
- [ ] `logActivity` helper in services, called from privileged actions (role change, status change, permission change, sign-in).
- [ ] `/admin/activity-logs`: list with search and filters.

### Admin shell

- [ ] Rebuild `admin-nav.ts` to the spec's information architecture (§4): Website, Courses, Learners, Commerce, Forms, Analytics, Marketing, SEO, Blog, Media, Users, Settings, Activity Logs. Remove "WooCommerce" and other mockup labels.
- [ ] Sidebar width 240–260px, collapsing to an icon rail of 68–72px on desktop; top bar 64–72px.
- [ ] Shared admin building blocks: page header, data table (sort, filter, pagination), status badge, confirm dialog, toast, empty / loading / error states.
- [ ] `loading.tsx`, `error.tsx` and `not-found.tsx` for the admin panel.

### Dashboard

- [ ] Replace the placeholder with database-backed widgets available now: user counts by role, new sign-ups, recent activity.
- [ ] Date range filter (Today, 7 Days, 30 Days, ... per §6), ready for the later revenue and course widgets.

### Quality

- [ ] Test setup: unit/integration (Vitest) and end-to-end (Playwright).
- [ ] Tests for the critical paths: login, logout, `/admin` blocked when signed out, blocked for a student, permission denied on an action, suspended user loses access.
- [ ] Check the admin shell at mobile, tablet and desktop widths.

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
