# Tasks

Current phase: **Phase 4 — LMS** (all four stages built, uncommitted). Phases and the long view are in [roadmap.md](roadmap.md).

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

Still open, later phases:

- [ ] Payment provider (spec says Stripe) — needed for Phase 5.
- [ ] Email provider — needed before production.

## Phase 4 — LMS

Spec §10 (courses), §11 (quizzes, certificates), §30 (course creation workflow).

### How it fits together

- **Structure:** a course has modules, a module has lessons, both in a fixed order the editor can rearrange by dragging (with keyboard buttons as well).
- **Lesson content:** a lesson is one of video, text (the same rich text editor as posts), PDF/download, or quiz. Lessons can be marked as free preview.
- **Publishing:** the same statuses and review rule as posts — draft, pending review, scheduled, published, archived; edit without publish permission means "submit for review".
- **Price:** each course carries its price and an optional "was" price in pounds; a price of 0 is a free course. Orders, coupons and bundles arrive in Phase 5 and will reuse these fields.
- **Enrolment:** a learner is enrolled in a course by joining a free course or by an admin assigning it. Enrolment is what unlocks the lessons; Phase 5 will create enrolments from paid orders.
- **Progress:** a lesson is complete when its rule is met — video watched to the end (or most of it), text and PDF opened and marked done, quiz passed. Course progress is completed lessons over all lessons.
- **Certificates:** issued automatically when every lesson is complete; each has an ID and a public verification page.
- **Protected files:** lesson videos and downloads are not public; the server hands a short-lived link only to enrolled learners, staff and free-preview lessons.
- **SEO:** courses get the same basic SEO fields as posts. Course schema (JSON-LD), sitemap and SEO checks stay in Phase 7.
- **Sample data:** the courses from the design move into the development seed with a few modules and lessons; made-up student and review counts are replaced by real ones.

### Stage 1 — foundation (one agent)

- [x] Schema and one migration: `Course`, `CourseCategory`, `CourseTag`, `CourseModule`, `Lesson`, `LessonResource`, `Enrolment`, `LessonProgress`, `CourseReview`, `Quiz`, `Question`, `QuizAttempt`, `Certificate`, plus `SeoData` extended to courses.
- [x] Permissions added and seeded: `course.view|create|edit|delete|publish`, `course-taxonomy.manage`, `enrolment.view|manage`, `review.moderate`, `certificate.view|manage`.
- [x] Private storage for lesson files and a helper that gives signed links only to people allowed to see the lesson.
- [x] Public catalogue from the database: `/courses`, `/courses/<slug>`, home page sections and hot deals keep their design; the course page shows the real curriculum.
- [x] Development seed with the sample courses, categories, modules and lessons.

### Stage 2a — course management in admin (parallel)

- [x] `/admin/courses`: list with search, status, category and instructor filters.
- [x] Course editor: title, subtitle, descriptions, thumbnail, intro video, price, category, tags, level, language, duration, instructor, badge, SEO fields, status and schedule.
- [x] Curriculum builder `/admin/courses/[id]/curriculum`: modules and lessons, add, rename, reorder by drag and by keyboard, move a lesson between modules, delete.
- [x] Lesson editors for video, text and PDF/download, with file upload through the chunked uploader; free-preview switch.
- [x] Course categories and tags.
- [x] Preview a course and its lessons before publishing; duplicate a course.

### Stage 2b — learning side (parallel)

- [x] Enrol in a free course from the course page; "Continue learning" when already enrolled.
- [x] Course player `/learn/<course>/<lesson>`: lesson list with completion ticks, video / text / PDF views, previous and next, mark complete, resume where the learner left off.
- [x] Progress stored per lesson and per course.
- [x] Student panel on real data: dashboard, My Courses, My Certificates. Offers and notifications stay sample data until their modules exist.
- [x] Learner reviews: rate and review a course once enrolled; shown publicly after approval.

### Stage 3 — quizzes, certificates, learners (one agent)

- [x] Quiz builder inside the curriculum: questions (multiple choice, multiple select, true/false), points, passing score, attempt limit, time limit, feedback text.
- [x] Taking a quiz in the player: timer, submit, score, pass or fail, review of answers; attempts and answers stored.
- [x] Certificates: issued on completion, certificate page with print/save, public verification URL, organisation name, logo and signature settings.
- [x] Admin Learners: all learners, enrolments (assign and remove a course), progress per learner and per course, certificates (view, revoke), review moderation.
- [x] Dashboard counts for courses, enrolments and completions; activity log entries for every Phase 4 action.

### Stage 4 — instructor panel and wrap-up (one agent)

- [x] `/instructor`: dashboard, my courses, the same course and curriculum editors limited to the instructor's own courses, submit for review, learners and progress of own courses.
- [x] A few Vitest unit tests: progress calculation, completion rules, quiz scoring, certificate ID format.
- [x] TypeScript, lint and tests pass; `roadmap.md` and this file updated.

### Not in Phase 4

- Payments, orders, coupons, bundles, memberships (Phase 5).
- Assignment and interactive lessons; matching, ordering and fill-in-the-blank questions; question bank and random questions.
- Video transcoding or adaptive streaming.
- Course schema (JSON-LD), sitemap and SEO checks (Phase 7); course analytics (Phase 8).
- Compare-and-restore revisions for courses.

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

## Done

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
