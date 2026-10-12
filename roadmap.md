# Roadmap

Source: `~/elearning_cms_admin_dashboard_requirements.docx` ("eLearning CMS & Admin Console — Product Requirements & UI/UX Specification", Moshiur Rahman). Section numbers below (§) refer to that document.

The current work list lives in [task.md](task.md). This file is the long view: what each phase delivers and where the project stands.

Status as of 2026-10-13: **Phases 1 and 2 built and committed; Phase 3 dropped; Phase 4 built, not yet committed.**

## Where the project differs from the spec

The spec was written generically; some choices were already made in this codebase. Items marked **open** need a decision before the phase that depends on them.

| Topic | Spec (§3 and others) | This project | State |
| --- | --- | --- | --- |
| Database | PostgreSQL | MySQL/MariaDB (`@prisma/adapter-mariadb`), one migration applied | decided 2026-10-12: MySQL is final |
| Data fetching | TanStack Query, Zustand where needed | No browser-side data calls: server components read, server actions mutate | decided |
| "API contracts" (§31) | Define API contracts before UI | No public API; the contract is the `src/services` and `src/actions` function signatures | decided |
| Forms | React Hook Form + Zod | shadcn fields + `useActionState`, Zod in server actions | decided 2026-10-12: Zod is mandatory for validation; React Hook Form may be added where a form needs it |
| Auth | not specified | Better Auth, DB-stored roles, optional TOTP 2FA | decided |
| Roles (§22) | Super Admin, Admin, Course Manager, Instructor, Content Editor, SEO Manager, Marketing Manager, Support, Finance, Learner | Seeded: `student`, `instructor`, `admin` (`admin` is the superuser) | decided 2026-10-12: role names stay as they are; other roles are created as data in the admin panel |
| Panels | Admin console only | Admin, student and instructor (built) | decided; student and instructor panels are extra scope |
| Payments (§12) | Stripe | none yet | **open** — confirm Stripe is available for the business's country |
| Email (§24) | Email settings | Logged to console; no provider | decided 2026-10-12: console logging for now; a provider is needed before production |
| Storage (§20) | S3-compatible | none yet | decided 2026-10-12: Cloudflare R2, through its S3-compatible API |
| Sidebar (§5) | 240–260px, collapses to 68–72px | 288px (`18rem`) | fix in Phase 1 |
| Admin nav (§4) | Website, Commerce, ... | Rebuilt to the spec's structure in Phase 1, without "Website Builder" | done |
| Website CMS pages (§7) | Pages, landing pages, templates | Not built; public pages stay coded | decided 2026-10-12: dropped, blog only |
| Visual page builder (§8, §9) | Elementor-style drag-and-drop builder | Not built; pages use a rich text body | decided 2026-10-12: dropped for now |

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

### Phase 2 — Blog and media (built and committed)

Stage-by-stage plan and decisions are in [task.md](task.md). Scope cut by the owner on 2026-10-12: no CMS pages and no page templates (spec §7), so only §20, §21 and post revisions from §23 are built.

- Media library on R2: chunked direct uploads, folders, alt text and metadata.
- Blog posts, categories, tags, authors — replaces the sample data in `src/services/blog.ts`.
- Draft / pending review / scheduled / published / archived, preview, duplicate.
- Revisions for posts: view, compare, restore.
- Basic SEO fields on posts (full SEO tooling is Phase 7).
- Dropped by the owner: navigation, header and footer management; the public header and footer stay coded.

### Phase 3 — Visual builder (dropped for now)

Dropped by the owner on 2026-10-12: the project will not use a visual page builder. Pages keep the rich text body from Phase 2. Spec §8 and §9 (builder, builder components, dnd-kit) are out of scope until this is reopened. Phase numbers are kept as in the spec, so Phase 4 follows Phase 2.

### Phase 4 — LMS (built, uncommitted)

Delivered: courses with categories, tags, modules, lessons (video, text, document, quiz), resources and private-bucket files; drag-and-drop curriculum; quizzes with single, multiple and true/false questions, attempts and time limits; enrolment (free join and admin-assigned), progress, reviews with approval, certificates with public verification; the student panel on real data; the instructor panel (`/instructor`: own courses, submit for review, read-only learners). Deferred: assignment and interactive lessons, other question types, question bank, server-side certificate PDFs, video streaming or transcoding. The checklist and decisions are in [task.md](task.md).

Original scope:

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
- Website CMS (pages, templates) — dropped for now (2026-10-12); blog only
- Visual page builder — dropped for now (2026-10-12)
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
- [ ] Media library (built; R2 storage verified from a script, browser upload not yet tried)
- [x] Blog CMS (posts, categories, tags, authors, workflow, preview; the editor UI is not yet browser-tested)
- [x] User management
- [x] Roles and permissions
- [x] Activity logs
- [x] Revision history (posts: list, view, compare, restore)
- [ ] Settings
- [ ] Security
- [ ] Performance
- [ ] Accessibility
- [ ] Testing
- [ ] Production deployment
