# Roadmap

Source: `~/elearning_cms_admin_dashboard_requirements.docx` ("eLearning CMS & Admin Console — Product Requirements & UI/UX Specification", Moshiur Rahman). Section numbers below (§) refer to that document.

The current work list lives in [task.md](task.md). This file is the long view: what each phase delivers and where the project stands.

Status as of 2026-10-12: **Phase 1 built; browser check by hand still open (see task.md).**

## Where the project differs from the spec

The spec was written generically; some choices were already made in this codebase. Items marked **open** need a decision before the phase that depends on them.

| Topic | Spec (§3 and others) | This project | State |
| --- | --- | --- | --- |
| Database | PostgreSQL | MySQL/MariaDB (`@prisma/adapter-mariadb`), one migration applied | decided 2026-10-12: MySQL is final |
| Data fetching | TanStack Query, Zustand where needed | No browser-side data calls: server components read, server actions mutate | decided; revisit only for the visual builder (Phase 3) |
| "API contracts" (§31) | Define API contracts before UI | No public API; the contract is the `src/services` and `src/actions` function signatures | decided |
| Forms | React Hook Form + Zod | shadcn fields + `useActionState`, Zod in server actions | decided 2026-10-12: Zod is mandatory for validation; React Hook Form may be added where a form needs it |
| Auth | not specified | Better Auth, DB-stored roles, optional TOTP 2FA | decided |
| Roles (§22) | Super Admin, Admin, Course Manager, Instructor, Content Editor, SEO Manager, Marketing Manager, Support, Finance, Learner | Seeded: `student`, `instructor`, `admin` (`admin` is the superuser) | decided 2026-10-12: role names stay as they are; other roles are created as data in the admin panel |
| Panels | Admin console only | Admin, student (built), instructor (planned) | decided; student and instructor panels are extra scope |
| Payments (§12) | Stripe | none yet | **open** — confirm Stripe is available for the business's country |
| Email (§24) | Email settings | Logged to console; no provider | decided 2026-10-12: console logging for now; a provider is needed before production |
| Storage (§20) | S3-compatible | none yet | decided 2026-10-12: Cloudflare R2, through its S3-compatible API |
| Sidebar (§5) | 240–260px, collapses to 68–72px | 288px (`18rem`) | fix in Phase 1 |
| Admin nav (§4) | Website, Commerce, ... | Ported from an HTML mockup: has "WooCommerce", "Website Builder", "Drag & Drop Editor" | fix in Phase 1 |

## Phases

Order follows §29. Each phase ends when its critical workflows are tested (§31).

### Phase 1 — Foundation (built, pending browser check)

Next.js, database, Prisma, authentication, RBAC, admin shell, dashboard shell, seed data, activity logging.

Acceptance criteria (§32):

| Criterion | State |
| --- | --- |
| Admin login/logout works | built |
| Unauthenticated users cannot access `/admin` | built (guard in the admin layout) |
| RBAC works at UI and backend levels | built — permissions seeded; every admin page and action checks them; nav and buttons filtered |
| Database and Prisma migrations work | built (on MySQL) |
| Seed data loads reliably | built (roles + first admin from env) |
| Dashboard reads database-backed data | built — user counts, sign-ups, recent activity, date-range filter |
| Sidebar navigation and collapse work | built (256px, 72px rail, 64px top bar); collapse not yet checked in a browser |
| User and permission management work | built — users, roles, permission matrix |
| Basic activity logging works | built — log table, helper, list page |
| TypeScript and linting pass | passing (2026-10-12) |
| No production credentials are hard-coded | ok — secrets in `.env`, which is git-ignored |
| Responsive behaviour is verified | not verified |
| Critical security controls are tested | exercised by hand-driven runs during the build; no automated end-to-end tests (owner's decision), Vitest unit tests only |

The auth module is complete: forgot/reset password, 2FA sign-in and setup, email verification banner, rate limiting.

### Phase 2 — CMS

Pages, blog, media, templates, revisions and publishing (§7, §20, §21, §23).

- Media library on object storage: upload, folders, alt text and metadata, WebP/AVIF.
- Pages with Draft / Pending Review / Scheduled / Published / Archived, preview, duplicate.
- Blog posts, categories, tags, authors — replaces the sample data in `src/services/blog.ts`.
- Revisions for pages and posts: view, compare, restore.
- Navigation, header and footer management.
- Shared `SEOData` fields on content (full SEO tooling is Phase 7).

### Phase 3 — Visual builder

Component registry, JSON tree, drag-and-drop, renderer, responsive controls, global styles (§8, §9). Not started until the Phase 2 content model and renderer are stable (§31).

### Phase 4 — LMS

Courses, modules, lessons, quizzes, progress and certificates (§10, §11, §30).

- Course, category, tag, module, lesson, lesson resource; drag-and-drop curriculum.
- Lesson types: video, text, PDF, download, interactive, quiz, assignment; completion rules.
- Quizzes: six question types, question bank, attempts, time limits.
- Enrolment and progress; reviews with approval.
- Certificate templates and public verification URLs.
- Replaces the sample data in `src/services/course.ts`, `review.ts` and `student.ts`; makes the student panel real.
- Instructor panel (`/instructor`).

### Phase 5 — Commerce

Products, orders, payments, coupons, refunds, enrolment automation (§12).

- Products: course, bundle, membership, digital product, voucher.
- Orders with timeline and the eight statuses; payments and refunds via verified webhooks.
- Coupons with limits, dates and applicable courses/categories.
- Moves the cookie cart (`src/services/cart.ts`) and the checkout page onto real orders.

### Phase 6 — Forms and marketing

Form builder, entries, pixels, UTM tracking, attribution, conversion events (§13, §14). Moves the contact form onto the form system.

### Phase 7 — SEO

Metadata, SEO checks, schema (JSON-LD), sitemap, robots, redirects, 404 monitor, Search Console (§16–§19).

### Phase 8 — Analytics

Traffic, revenue, course and learner performance, marketing attribution, CSV export (§15); the full dashboard widgets of §6.

### Phase 9 — Hardening

Security review, rate limiting, performance, accessibility, test coverage, logging, backups, deployment (§25, §26).

## Feature checklist (§33)

- [x] Admin authentication
- [x] Role-based access control
- [ ] Dashboard
- [ ] Website CMS
- [ ] Visual page builder
- [ ] Course management
- [ ] Curriculum builder
- [ ] Lesson management
- [ ] Quiz system
- [ ] Certificate system
- [ ] Learner management
- [ ] Commerce
- [ ] Orders
- [ ] Coupons
- [ ] Forms
- [ ] Form entries
- [ ] Marketing pixels
- [ ] UTM attribution
- [ ] Analytics
- [ ] SEO
- [ ] Course schema
- [ ] Sitemap
- [ ] Robots.txt
- [ ] Redirect manager
- [ ] 404 monitor
- [ ] Search Console integration
- [ ] Media library
- [ ] Blog CMS
- [x] User management
- [x] Roles and permissions
- [x] Activity logs
- [ ] Revision history
- [ ] Settings
- [ ] Security
- [ ] Performance
- [ ] Accessibility
- [ ] Testing
- [ ] Production deployment
