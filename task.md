# Tasks

Current phase: **Phase 5 — Commerce** (all three stages built and checked from the server and in the dev server's pages, not yet in a browser; uncommitted). Phases and the long view are in [roadmap.md](roadmap.md).

Tick a task when it is built and checked in the browser. Add new tasks under the phase they belong to; move finished phases to the bottom.

## Decisions

Made 2026-10-12:

- Database: MySQL/MariaDB is final (not PostgreSQL).
- Role names stay as they are: `student`, `instructor`, `admin`. Other roles are created as data.
- Forms: shadcn fields with server actions; Zod is mandatory for validation. React Hook Form may be added where a form needs it.
- Email: console logging only for now.
- Storage: Cloudflare R2, through its S3-compatible API (Phase 2 media).
- Packages are installed with the pnpm CLI (`pnpm add`, `pnpm dlx shadcn add`), never by editing `package.json` by hand.

- Tests: a few Vitest unit tests per phase; no Playwright or other end-to-end tests.
- No visual page builder: Phase 3 is dropped; Phase 4 follows Phase 2.

Phase 2 decisions, made 2026-10-12:

- Subagents run on Sonnet (never Opus).
- Rich text editor: Tiptap, content stored as JSON.
- Uploads go straight from the browser to R2 with presigned URLs; large files are split into chunks (S3 multipart) and the chunks are uploaded in parallel. Limits: images 25 MB, PDFs and documents 50 MB, video 2 GB.
- About and Contact stay as coded pages.
- No CMS pages or page templates: Phase 2 is the blog and the media library only.

Phase 4 decisions, made 2026-10-12 (the owner approved every recommendation):

- Subagents run on Sonnet.
- Lesson files live in a second, private R2 bucket (`R2_PRIVATE_BUCKET`); enrolled learners get short-lived signed links. Thumbnails and other public images stay in the public bucket.
- Video: uploaded MP4 files played directly. No YouTube/Vimeo links and no streaming service.
- Enrolment before payments: learners join free courses themselves; an admin assigns paid courses.
- Lesson types: video, text, PDF/download, quiz. Assignment and interactive lessons later.
- Quiz question types: multiple choice, multiple select, true/false. The rest and the question bank later.
- Certificates: one built-in design as a printable web page, with a public verification link. No server-generated PDFs or multiple templates.
- The instructor panel is part of this phase (stage 4).
- Course reviews by enrolled learners, shown after admin approval, are part of this phase.

Phase 5 decisions, made 2026-10-13 (the owner approved every recommendation):

- Subagents run on Sonnet.
- Payments: Stripe, using Stripe's hosted payment page. Card details never touch this site.
- Only single courses are sold. No bundles, memberships, digital products or vouchers. "Product" in the spec means a course; "order" means a course purchase.
- One of each course per buyer; the cart has no quantities.
- Only signed-in learners can check out; sign-up or login happens on the way and returns to checkout.
- Checkout keeps the billing details step and drops "student details"; payment happens on Stripe's page.
- Refunds: a whole order or single courses in it; the refunded course's access is removed. No typed-amount refunds.
- Admin menu: Orders and Coupons only; payments and refunds are shown on each order.
- Coupons: percentage or fixed amount; total usage limit, per-learner limit, start and use-before dates, minimum spend, chosen courses and/or categories; one coupon per order.

Still open, later phases:

- [ ] Email provider — needed before production.

## Phase 5 — Commerce

Spec §12. In the spec, "product" means a course and "order" means a course purchase: there is no separate product catalogue, the price stays on the course.

### How it fits together

- **Cart:** stays in a cookie, holds courses only. Courses the learner already owns and free courses are kept out of it; free courses are joined directly, as now.
- **Order:** created when the learner presses pay, with a number, the buyer, billing details, one line per course (title and price copied at that moment), the coupon and discount, and the total in pounds. Prices include VAT; no tax is calculated.
- **Payment:** the learner is sent to Stripe to pay and comes back to an order confirmation page. Stripe tells the site the result through a verified webhook; the order is marked paid only from that message, never from the return page alone.
- **Enrolment:** a paid order enrols the learner in each course straight away (source "order"). An order whose total is 0 after a coupon completes without Stripe.
- **Statuses:** pending, paid, failed, cancelled, refunded, partially refunded. "Processing" and "completed" from the spec are left out because a course is delivered the moment it is paid.
- **Timeline:** every order keeps a dated history: created, payment started, paid, failed, refunded, notes added by staff.
- **Coupons:** a code gives a percentage or a fixed amount off. Each coupon can have: a start date and a use-before date; a total usage limit (for example 50 uses); a per-learner limit (for example once each); a minimum spend; and a restriction to chosen courses and/or categories, in which case the discount applies only to matching courses in the cart. One coupon per order. A use is counted when the order is placed and given back if the payment fails or the order is cancelled, so a limit cannot be overshot.
- **Refunds:** made by an admin from the order page and sent to Stripe; the learner loses access to the refunded course and the order shows as refunded or partially refunded.
- **Receipts:** an order page the learner can print; Stripe sends its own payment receipt by email. Site emails stay console-only.

### Stage 1 — foundation (one agent)

- [x] Schema and one migration: `Order`, `OrderItem`, `Payment`, `Refund`, `OrderEvent`, `Coupon` with its course and category links, `CouponRedemption`.
- [x] Permissions added and seeded: `order.view|manage|refund`, `coupon.view|manage`.
- [x] Pricing and coupon rules as pure functions: cart totals, which lines a coupon applies to, discount split per line, every reason a coupon is refused.
- [x] Stripe set up: package, keys in `.env` and `.env.example`, one place that talks to Stripe.
- [x] Cart brought in line: no quantities, owned and free courses kept out.

### Stage 2a — checkout and payment (parallel)

- [x] Cart page with coupon code entry and the discount shown per course.
- [x] Checkout: sign-in on the way, billing details, order summary, pay.
- [x] Order creation, Stripe payment page, verified webhook, enrolment on payment, coupon use counted and given back.
- [x] Order confirmation page, failed and cancelled payment states, pay again for a pending order.
- [x] Student panel: My Orders with printable receipts.

### Stage 2b — orders and coupons in admin (parallel)

- [x] `/admin/orders`: list with search, status and date filters; order page with lines, buyer, billing details, payments, timeline and staff notes.
- [x] `/admin/coupons`: list, create and edit with every limit above, switch on and off, usage count and the orders that used it.
- [x] Commerce menu reduced to what exists.

### Stage 3 — refunds and wrap-up (one agent)

- [x] Refund a whole order or single courses from the order page; access removed; Stripe refund messages handled.
- [x] Admin dashboard: revenue, orders and average order value. Instructor dashboard: sales of own courses.
- [x] Activity log entries for every Phase 5 action.
- [x] A few Vitest unit tests: coupon rules, discount split, order totals, status changes, refund plans.
- [x] TypeScript, lint and tests pass; `roadmap.md` and this file updated.

### Not in Phase 5

- Bundles, memberships, digital products, vouchers, gifting and buying for other people.
- Tax calculation, VAT invoices with numbering, multiple currencies.
- Subscriptions and instalments; saved cards.
- Marketing attribution on orders (Phase 6); commerce analytics and reports (Phase 8).

## Carried over from earlier phases

- [ ] Browser check, by hand: admin shell at mobile, tablet and desktop widths; two-factor setup (QR, backup codes, verify, redirect back with "Two-factor authentication is on"); the code input on `/two-factor`; confirm dialogs and toasts; keyboard use of the permission matrix.
- [ ] Decide whether `.idea/` stays in git; if not, remove it and git-ignore it.
- [ ] "No access" and not-found pages inside the admin panel show the right content but answer HTTP 200, because `src/app/(admin)/loading.tsx` starts streaming before the permission check. A fix means moving the loading boundary into each route segment (or a `proxy.ts` permission map).
- [ ] Nothing calls `pruneRateLimits`; old `rate_limit` rows are only overwritten when their key is hit again.
- [ ] The user detail page lists activity done by the user, not actions done to them.
- [ ] Leftovers of the cancelled Playwright setup: `lms_test` database, Chromium in `~/Library/Caches/ms-playwright/`, a stale `@playwright/test` entry in `pnpm-lock.yaml`.
- [ ] Phase 2 browser check: a file over 10 MB (chunked path) and a mislabelled file at `/admin/media`; the post editor, tag input, media picker and a post with a featured image.
- [ ] Private R2 bucket: created and working from the server (2026-10-13), but it has no CORS rule yet, so browser uploads of lesson files are blocked. Add the same rule as the public bucket (PUT from the site address, all headers, expose `ETag`), then test a lesson file upload.
- [ ] Phase 4 browser check, by hand (built and checked from the server only): the instructor panel at mobile and desktop widths (sidebar, dashboard, course editor as an instructor, submit for review, locked form once published); curriculum drag-and-drop and keyboard reorder; lesson file upload, replace and remove; video playback, resume position and auto-complete; PDF view and downloads; star rating and review form; player sidebar on mobile; quiz builder dialogs, quiz timer and auto-submit; certificate print / save as PDF layout (and a long name); login return through two-factor; enrol for free then login and return.
- [ ] Add the production site address to the R2 bucket's CORS `AllowedOrigins` when deploying.
- [ ] Post form: after a failed save, the canonical URL, noindex switch and schedule time may lose what was typed (untested).

- [ ] Phase 5 browser check, by hand: pay with a Stripe test card and return to the order page, a declined card, coupon entry in the cart, pay again on a pending order, receipt print, the admin order page, a refund (whole order and one course; with `stripe listen` running for the webhook), the coupon form pickers and dates.
- [ ] Schedule `sweepExpiredOrders` (no scheduled jobs exist yet); until then pending orders are only closed when someone opens or pays them.

## Done

### Phase 4 — LMS (committed 2026-10-13)

- Courses, modules and lessons (video, text, document, quiz) with the post-style publishing workflow; private R2 bucket for lesson files.
- Enrolment (free self-enrol, admin assign), course player, progress, learner reviews with moderation.
- Quizzes (single choice, multiple select, true/false), certificates with public verification, admin Learners screens.
- Instructor panel limited to own courses.
- 91 unit tests pass. Browser checks are listed under "Carried over".

### Phase 2 — Blog and media (committed 2026-10-12)

- [x] Media library on R2: chunked direct uploads, folders, metadata, media picker. Storage verified from a script; a 9.6 MB image uploaded in the browser by the owner.
- [x] Blog: posts with review, publish and schedule workflow, duplicate, preview; revisions with compare and restore; categories, tags, authors.
- [x] Public blog on the database with category and tag filters, related posts and SEO metadata; sample posts in the development seed.
- [x] Dropped by the owner: CMS pages, page templates, menus, header/footer management, visual builder.

### Phase 1 — Foundation (committed 2026-10-12)

- [x] Auth: login, sign-up, logout, forgot/reset password, 2FA sign-in and setup, email verification banner, rate limiting.
- [x] RBAC: permission list in `src/lib/permissions.ts`, seeded; every admin page and action checks permissions; "No access" page.
- [x] Admin: users, roles and permission matrix, activity log, database-backed dashboard with date-range filter.
- [x] Admin shell: navigation per spec §4, 256px sidebar with 72px rail, top bar, shared table / badge / dialog / toast components, account page.
- [x] Vitest with unit tests for `parseDateRange` and `panelForRole` / `panelHome`.

### Before Phase 1

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
