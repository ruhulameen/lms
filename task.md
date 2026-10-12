# Tasks

Current phase: **Phase 2 — Blog and media** (stages 1 and 2 built; waiting on a browser check). Phases and the long view are in [roadmap.md](roadmap.md).

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
- No visual page builder: Phase 3 is dropped for now; pages use a rich text body.

Phase 2 decisions, made 2026-10-12:

- Subagents run on Sonnet (never Opus).
- Rich text editor: Tiptap, content stored as JSON.
- Uploads go straight from the browser to R2 with presigned URLs; large files are split into chunks (S3 multipart) and the chunks are uploaded in parallel. Limits: images 25 MB, PDFs and documents 50 MB, video 2 GB.
- About and Contact stay as coded pages.
- No CMS pages or page templates: Phase 2 is the blog and the media library only.

Needed from the owner:

- [x] R2 bucket and keys in `.env`, and the bucket CORS rule (added in the Cloudflare dashboard; the API token may not change bucket settings, so `pnpm storage:cors` is refused). Verified 2026-10-12 from a script through `src/lib/storage.ts`: single upload, 23 MB chunked upload, public read, abort, delete, CORS preflight.
- [ ] Browser check of uploads at `/admin/media`: an image, a video over 10 MB, and a mislabelled file that must be rejected. Then a post with a featured image.
- [ ] Add the production site address to the bucket's CORS `AllowedOrigins` when deploying.

Still open, later phases:

- [ ] Payment provider (spec says Stripe) — needed for Phase 5.
- [ ] Email provider — needed before production.

## Phase 2 — Blog and media

Spec §20 (media), §21 (blog), §23 (revisions for posts). Scope cut by the owner on 2026-10-12: no CMS pages, no page templates — only blog posts and the media library. Two stages, one agent each.

### How it fits together

- **Content format:** post bodies are rich text (Tiptap) stored as JSON and rendered on the server by one renderer; raw HTML is never stored as the source.
- **Publishing:** one status field plus a `publishAt` time. "Scheduled" needs no cron: public queries show posts whose status is Published, or Scheduled with `publishAt` in the past.
- **Review:** a user with `post.edit` but not `post.publish` can only save drafts and submit for review; a user with `post.publish` approves, schedules, publishes or archives.
- **Revisions:** every save of a post stores a snapshot. Restore creates a new revision; nothing is overwritten.
- **Media:** files live in R2; the database holds one `Media` row per file. Posts reference media by id. Images are served through `next/image`.
- **SEO:** each post has basic SEO fields now (SEO title, meta description, canonical, noindex, social image). Checks, schema, sitemap and redirects are Phase 7.

### Stage 1 — foundation (one agent)

- [x] Schema and one migration for the Phase 2 models: `Media`, `MediaFolder`, `BlogPost`, `BlogPostRevision`, `BlogCategory`, `BlogTag`, `SeoData`, plus `User.bio`.
- [x] Permissions added and seeded: `media.view|upload|edit|delete`, `post.view|create|edit|delete|publish`, `blog-taxonomy.manage`.
- [x] Storage module for R2 (`src/lib/storage.ts`): presigned single and multipart uploads, complete, abort, delete, public URL; credentials only from env, never sent to the browser. Bucket CORS set by a script.
- [x] Chunked uploader: parallel parts, per-file progress, retry and cancel.
- [x] Media library `/admin/media`: upload (type and size validated on the server), grid and list views, search, filter by type, folders, rename, edit alt text / title / caption / description, delete (blocked or warned when in use).
- [x] Media picker dialog, reused by every "featured image" field and by the editor.
- [x] Rich text editor component and the server renderer for its JSON.
- [x] Shared pieces: slug helper, publish-status helper, revision helper, SEO fields form section.
- [x] Turn on the Media and Blog items in the admin sidebar as their pages arrive.

### Stage 2 — blog (one agent)

- [x] `/admin/blog`: posts list with search, status, category and author filters, sort, pagination.
- [x] Post editor: title, slug, body, excerpt, featured image, category, tags, author, featured flag, SEO fields, status and schedule controls.
- [x] Submit for review, publish, schedule, unpublish, archive, duplicate, delete.
- [x] Preview of unpublished posts for signed-in staff.
- [x] Revision history: list, view, compare two revisions, restore.
- [x] Categories and tags: create, rename, delete, post counts.
- [x] Authors: list of users with posts, with a short public bio.
- [x] Replace the sample data in `src/services/blog.ts` with database queries, keeping the public blog pages working; move the sample posts into the development seed.
- [x] Activity log entries for every mutation; dashboard counts for posts and media, Quick Create for a post.
- [x] A few Vitest unit tests; TypeScript, lint and tests pass; `roadmap.md` and this file updated.

Checked against the running dev server with real server action calls (no browser): the rich text editor, tag input, dialogs and media picking are not browser-tested, and featured images are untested until an upload has been done in the browser.

### Not in Phase 2

- CMS pages, page templates and the visual page builder — dropped by the owner.
- Navigation, header and footer management — dropped by the owner (not a WordPress-style site); the public header and footer stay coded.
- SEO checks, schema, sitemap, robots, redirects (Phase 7).
- Course and lesson media handling such as video streaming and lesson attachments (Phase 4).

## Carried over from Phase 1

- [ ] Browser check, by hand: admin shell at mobile, tablet and desktop widths; two-factor setup (QR, backup codes, verify, redirect back with "Two-factor authentication is on"); the code input on `/two-factor`; confirm dialogs and toasts; keyboard use of the permission matrix.
- [ ] Decide whether `.idea/` stays in git; if not, remove it and git-ignore it.
- [ ] "No access" and not-found pages inside the admin panel show the right content but answer HTTP 200, because `src/app/(admin)/loading.tsx` starts streaming before the permission check. A fix means moving the loading boundary into each route segment (or a `proxy.ts` permission map).
- [ ] Nothing calls `pruneRateLimits`; old `rate_limit` rows are only overwritten when their key is hit again.
- [ ] The user detail page lists activity done by the user, not actions done to them.
- [ ] Leftovers of the cancelled Playwright setup: `lms_test` database, Chromium in `~/Library/Caches/ms-playwright/`, a stale `@playwright/test` entry in `pnpm-lock.yaml`.

## Done

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
