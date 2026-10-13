# Tasks

Current phase: **Phase 5 — Commerce** (all three stages built and checked from the server and in the dev server's pages, not yet in a browser; uncommitted). Phases and the long view are in [roadmap.md](roadmap.md).

Tick a task when it is built and checked in the browser. Add new tasks under the phase they belong to; move finished phases to the bottom.

## Decisions

Made 2026-10-12:

- Database: MySQL/MariaDB is final (not PostgreSQL).
- Role names stay as they are: `student`, `instructor`, `admin`. Other roles are created as data.
- Forms: shadcn fields with server actions; Zod is mandatory for validation. React Hook Form may be added where a form needs it.
- Email: console logging only for now. (Changed 2026-10-13: SMTP through a queue, see "Email" below; the console is still used when `SMTP_HOST` is empty.)
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

- [ ] Email provider — the app now sends over SMTP, but no provider or sending domain is chosen yet; fill in `SMTP_*` and `EMAIL_FROM` in `.env`.

## Tracking, pixels and reports (2026-10-13)

Decided by the owner: server-side purchase tracking for accuracy, a cookie consent banner, and all four report groups. Left to my recommendation: all six platforms as ID fields, tracking before reports, no traffic analytics of our own (that is Google Analytics' job).

### Tracking

- [x] Settings > Tracking: Meta Pixel, Google Analytics 4, Google Ads, TikTok, LinkedIn and Google Tag Manager IDs; the Meta Conversions API token and the GA4 API secret (stored encrypted); the cookie banner switch.
- [x] Cookie banner with Accept and Reject, and a "Cookie settings" link in the footer to change the answer. No tag loads and no cookie of ours is written before Accept. The admin and instructor panels are never tracked.
- [x] Events to every tag that is switched on: page view, course viewed, added to cart, checkout started, purchase (value, currency, courses, coupon), sign-up.
- [x] Purchases are also sent from the server to Meta and Google Analytics when an order is marked paid (the Stripe webhook), once per order, only for buyers who accepted tracking. Meta counts the browser and server reports as one (shared event id); Google Analytics gets the purchase from the server only.
- [x] Where a visitor came from (campaign tags, ad click ids, or the referring site) is remembered for 90 days and stored on the account at sign-up and on the order at checkout.
- [x] Unit tests for the attribution rules. Checked in the browser with made-up IDs: nothing loads before Accept, both scripts load after, the campaign is remembered, and course view, add to cart and checkout started fire.

### Reports

- [x] `/admin/analytics`: Sales, Courses, Learners, Marketing, each with the date range picker, headline figures against the previous period, a chart and tables. New permission `analytics.view`.
- [x] Every table downloads as CSV for the chosen period.
- [x] Sales: revenue, orders, average order value, refunds, discounts; best-selling courses; revenue by category; coupons; sales by day or month.
- [x] Courses: new enrolments, completions, completion rate, rating; a row per course; the lesson unfinished learners are on; quiz pass rates.
- [x] Learners: sign-ups, active learners, sign-up to purchase rate, repeat buyers; top spenders; sign-ups by day or month.
- [x] Marketing: sign-ups, orders and revenue by source and by campaign.
- [x] Unit tests for the CSV output. Checked in the browser: all four reports against the sample data.

### Left to do

- Not tried against the real platforms: no real pixel, token or API secret was available, so the server-side purchase calls and each vendor's event names are unverified. Meta's "Test event code" field is there for that first check.
- Not tried: a purchase event in the browser (needs a Stripe payment), the sign-up event, a CSV download, Reject then Accept on the banner.
- Server-side purchases are sent once and not retried; a failure is only written to the server log.
- LinkedIn gets page views and audiences only (its conversions need an ID per event). TikTok and Google Ads purchases come from the browser only.
- Refunds are not reported back to the ad platforms.
- The banner is one Accept / Reject choice, not separate analytics and advertising switches, and its wording is generic: it needs a privacy policy page to link to.
- Marketing report rows before tracking was switched on, and from visitors who rejected cookies, all show as "Direct".
- Reports add rows up in memory; fine for tens of thousands of orders, after that they want database GROUP BYs.
- Removed from the admin menu: the whole Marketing group (tracking is under Settings > Tracking, campaign results under Reports > Marketing) and the Traffic and Overview placeholders.

## Settings — admin editable (2026-10-13)

Decided by the owner: the site is run by a non-technical person, so everything they may need to change is on a screen, keys and passwords included. Tax is left out until the client's needs are known. One currency for the whole site (pounds, dollars or euros), not one per course.

- [x] `setting` table: one row per group, the fields as JSON. Secret fields (Stripe keys, SMTP password, storage secret key) are stored encrypted with a key derived from `BETTER_AUTH_SECRET`, shown only as their last four characters, and never logged.
- [x] `/admin/settings` with five screens: Site, Certificate, Payments, Email, File storage. New permission `settings.manage`; changes go to the activity log by field name.
- [x] Site: name, tagline, description, logo, browser tab icon, contact details, social links, sign-up on/off. Used by the header, footer, page titles, panels, receipts and the sign-up page.
- [x] Certificate: organisation, title, signatory, logo and signature image, with a preview that changes while typing. Applies to certificates already issued. `src/lib/certificate-config.ts` is gone.
- [x] Payments: currency, "Take payments" switch, how long an unpaid order lives, Stripe secret key and webhook secret, the webhook address to copy, and a "Check Stripe connection" button.
- [x] Email: from name and address, reply-to, mail server, and a "Send test email" button.
- [x] File storage: R2 account, both buckets, public address, a connection check, and an "Allow uploads" button that does what `pnpm storage:cors` did.
- [x] An empty setting falls back to the value in `.env`, so a server set up that way keeps working. Only `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` must stay in `.env`.
- [x] Settings are held in memory (`src/lib/settings-store.ts`), loaded at start-up by `src/instrumentation.ts`, replaced on save, and re-read every 30 seconds in case another process saved them.
- [x] Unit tests: sealing and opening a secret, how saved values and `.env` values combine, masking. Checked in the browser: saving the name and currency, the Stripe and storage checks, saving and removing a secret, the certificate preview.

### Left to do

- Not tried for real: "Send test email", "Allow uploads", choosing a logo or signature from the media library, sign-up switched off.
- Orders keep the currency they were placed in and are paid and refunded in it, but the order screens show every amount with the site's current symbol. The Payments screen warns about this.
- Any https image host is now accepted by the image optimiser, because the storage address can change while the server runs.
- Changing `BETTER_AUTH_SECRET` makes saved keys unreadable; they then have to be typed in again.
- Deleting a media file that is in use as a logo, icon or signature leaves a broken image; the media library does not list settings as a use.
- Later groups: tax, business details for receipts, SEO and tracking, legal pages.

## Admin dashboard redesign

Built 2026-10-13 in the main session. Not committed.

- One date range button replaces the row of buttons and the From / To form: Today, Yesterday, This week, Last week, This month (the default), Last month, This year, Last year, All time, and a custom range picked on a two-month calendar. Built on the shadcn calendar, not Ant Design, to stay on the project's component set.
- Stat cards with icon, figure and change against the previous period; revenue, paid orders, average order value, refunds, new sign-ups, new enrolments, active enrolments, total users.
- Charts drawn with Highcharts (loaded in the browser only): revenue, sign-ups, users by role; and enrolments per month on the course overview. Ranges over 92 days are charted per month. The hand-drawn bar chart is removed.
- Checked in the browser at desktop width: presets, All time, This year, a custom range, the course overview chart.
- [ ] Highcharts is free only for non-commercial use: buy a licence before the site goes live, or swap the two chart components in `src/components/admin/highcharts-charts.tsx` for a free library.
- [ ] Check the dashboard and the picker at phone and tablet widths.

## Notifications — students

Built 2026-10-13 in the main session. Not committed. Admin and instructor notifications come later; the `notification` table and `notify()` (`src/services/notification.ts`) are already general.

- Student notifications page reads the database: grouped Today / This week / Earlier, unread highlighted, "Mark all as read", 30 per page. Opening one marks it read and goes to its page. Unread count shows next to Notifications in the student menu.
- Written when: an order is confirmed, a payment fails, a refund completes, an admin assigns a course, access is cancelled or restored, a course is completed (certificate ready), a personal coupon is given, a review is approved or rejected.
- Checked in the browser with temporary rows: the list, the badge, opening one, mark all as read.
- [ ] Trigger each event for real once (assign a course, approve a review, give a personal coupon, refund an order) and see the notification arrive: the hooks are only type-checked so far.
- [ ] In-app only: no extra emails are sent for these events yet (order confirmation already has one).
- [ ] Not included: quiz results, new lessons on a course, coupon about to expire (needs a scheduled job), account security events, per-learner preferences.
- [ ] Old notifications are never deleted.

## Offers and personal coupons

Built 2026-10-13 in the main session. Not committed.

- A coupon can be reserved for chosen learners ("Who can use it" on the coupon form, `coupon_user` table). With nobody chosen it stays open to everyone. The cart and checkout refuse it for anyone else.
- My Offers reads the database: coupons that are switched on, inside their dates, open to the learner and with uses left. Personal ones are marked "Just for you".
- Checked in the browser as a learner: offers list, a personal coupon applying in the cart, another learner's coupon refused.
- [ ] Browser check as admin: choosing learners on the coupon form, saving, and the "Personal" line in the coupon list.
- [ ] Every open coupon shows on every learner's My Offers page. If some codes should stay private (partner or campaign codes), add a "show on My Offers" switch.
- [ ] The learner picker loads every student; replace with a search box when there are thousands.

## Email — SMTP and queue

Built 2026-10-13 in the main session. Not committed.

- `sendEmail` (`src/lib/email.ts`) writes the email to the `email_outbox` table and returns; the SMTP send (Nodemailer, `src/lib/mailer.ts`) runs after the response has gone out, so sign-up, checkout and the contact form do not wait on the mail server.
- A failed send is tried again after 1, 5, 30 and 120 minutes, then given up on (5 attempts). The body is emptied once sent, because it can hold reset links.
- Checked with a script against a throwaway local SMTP server (delivered, row marked sent) and a dead port (marked failed, retry in 60 s). Unit test for the retry schedule.
- [ ] Restart `pnpm dev` (the running server still holds the old database client, so any email fails until then), then try the contact form and a password reset.
- [ ] Choose a provider and fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`; send one real email.
- [ ] Retries only happen when another email is queued. Add a scheduled job (with `sweepExpiredOrders`) that calls `deliverDueEmails`.
- [ ] Later: HTML templates, an admin screen for the email log, more emails (enrolment, refund, certificate).

## Admin rework — employees, roles, learners, course insight

Asked for on 2026-10-13. Decisions made the same day; built by three Sonnet agents. Type check, lint and 140 unit tests pass; the pages have not been opened in a browser yet, so the boxes stay unticked.

### What exists today

- `/admin/users` lists every account (students included); `/admin/users/[id]` edits one and changes its status.
- `/admin/users/roles` is one page: role table, a dialog for name and description, and a permission matrix for all roles at once.
- `/admin/learners` lists only people who have an enrolment, with a search box and no filters; `/admin/learners/[id]` shows courses and quiz results.
- `/admin/courses/[id]` just redirects to the edit form; the course has a Learners tab but no figures.

### Decisions (2026-10-13)

- URLs move to `/admin/employees` and `/admin/roles`. The old `/admin/users...` pages are removed with no redirects.
- A learner is everyone with the `student` role, enrolled or not.
- The all-roles permission matrix is removed; permissions are edited on each role's own page.
- The course overview is in the admin panel only.
- Built by Sonnet agents.

### 1. Employees and roles

- [ ] Menu group "Users" becomes "Employees & Roles" with two links: Employees, Roles.
- [ ] Employees list: every account whose role is not `student` (instructors, admins, custom roles). Search by name or email; filters for role, status, email verified, 2FA; sortable; paginated. "New employee" form offers every role except `student`.
- [ ] Employee detail keeps the edit form, status controls and recent activity; the learning and orders blocks move to the learner page.
- [ ] Roles list (`/admin/roles`): table with name, description, system badge, employees, permissions; search and pagination; View / Edit / Delete actions.
- [ ] Role detail (`/admin/roles/[id]`): description, granted permissions grouped by module, the people who hold the role.
- [ ] Role add (`/admin/roles/new`) and edit (`/admin/roles/[id]/edit`): name, description, and every permission as a checkbox grouped by module, with "select all" per group. One save writes the role and its permissions together.
- [ ] System roles (`student`, `instructor`, `admin`): view only. No edit page (it answers "not found"), no delete, and the actions refuse them on the server as well.
- [ ] Permission keys stay (`user.*`, `role.*`); only their labels change to "Employees".
- [ ] `/admin/users...` pages deleted, no redirects. Opening a student under `/admin/employees/[id]` goes to their learner page.

### 2. Learners

- [ ] List: name, email, account status, courses, completed, average progress, certificates, total spent, joined, last activity. Search by name or email; filters for account status, course, progress (not started / in progress / completed), has certificate, has bought, joined date range; sortable; paginated.
- [ ] "New learner" button (creates a `student` account), for people with `user.create`.
- [ ] Detail page, in sections:
  - Basic info: name, email, joined, email verified, 2FA, status, last sign-in; edit form and suspend / ban / reactivate (same permissions as today).
  - Summary tiles: courses, completed, average progress, certificates, orders, lifetime value, refunded.
  - Courses: each enrolment with source (free / assigned / bought), status, progress, lessons done, last activity, quiz attempts and best score, certificate; assign and cancel as now.
  - Quiz results (existing).
  - Certificates: code, course, issued, revoked or not, link to the public check.
  - Orders and payments: every order with status, coupon, total, paid date, card; link to the order.
  - Refunds: amount, date, reason, status, which courses.
  - Reviews written, and recent activity.
- [ ] Lifetime value = paid order totals minus refunds. Money sections need `order.view`; others show to `enrolment.view`.

### 3. Course detail

- [ ] `/admin/courses/[id]` becomes an "Overview" tab (first in the course tabs) instead of a redirect.
- [ ] Tiles: enrolled, in progress, completed, completion rate, average progress, cancelled, certificates issued, rating and review count, revenue, refunded, net revenue.
- [ ] Enrolments by source (free / assigned / bought) and enrolments per month.
- [ ] Progress spread: not started, 1–49%, 50–99%, completed.
- [ ] Lesson by lesson: how many learners finished each lesson, to show where people stop.
- [ ] Quizzes: attempts, pass rate, average score per quiz.
- [ ] Recent enrolments, recent certificates, recent orders, each linking to its full list.
- [ ] Revenue tiles and orders need `order.view`.

### Tests

- A few Vitest unit tests only: lifetime value and net revenue sums, the progress-spread buckets, and the system-role check (`tests/unit/`).

### Left to do

- [ ] Browser check, by hand: employees list filters and new employee; role add / edit with permission ticks, a system role (view only); learners list filters, new learner, learner detail with a learner who has orders and a refund; course Overview tab on a course with enrolments and sales.
- [ ] Run `pnpm db:seed` so the reworded permission descriptions ("employees") reach the database.
- [ ] The course overview's "All orders" link opens the full orders list: the orders page has no course filter.

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
