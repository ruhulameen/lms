import "dotenv/config";
import { auth } from "../src/lib/auth";
import type { Prisma } from "../src/generated/prisma/client";
import { backfillCertificateRecords } from "../src/lib/certificate-issue";
import { calculateCouponDiscount, priceOrder, toPence, toPounds } from "../src/lib/commerce";
import { db } from "../src/lib/db";
import { allPermissions, defaultInstructorPermissions } from "../src/lib/permissions";
import { blocksToDocument, type PostBlock } from "../src/lib/rich-text";
import { slugify } from "../src/lib/slug";
import { genericModules, sampleCourses } from "./seed-courses";

// `student` and `instructor` are reserved names: panel routing depends on them.
const roles = [
  { name: "student", description: "Learner enrolled in courses" },
  { name: "instructor", description: "Creates and teaches courses" },
  { name: "admin", description: "Full access to the admin panel" },
];

// Keeps the permission table equal to the list in src/lib/permissions.ts.
// A permission seen for the first time is also granted to the roles named in
// its defaults (instructors get course.view|create|edit); existing assignments
// are never touched, so changes made in the permission matrix survive a re-seed.
async function seedPermissions() {
  const instructor = await db.role.findUnique({ where: { name: "instructor" }, select: { id: true } });
  let granted = 0;
  for (const permission of allPermissions) {
    const existing = await db.permission.findUnique({ where: { key: permission.key }, select: { id: true } });
    const row = await db.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: { key: permission.key, description: permission.description },
    });
    if (!existing && instructor && defaultInstructorPermissions.includes(permission.key)) {
      await db.rolePermission.create({ data: { roleId: instructor.id, permissionId: row.id } });
      granted++;
    }
  }
  const { count } = await db.permission.deleteMany({
    where: { key: { notIn: allPermissions.map((p) => p.key) } },
  });
  console.log(
    `Seeded ${allPermissions.length} permissions` +
      (granted ? `, granted ${granted} to instructor` : "") +
      (count ? `, removed ${count} obsolete` : ""),
  );
}

// Self sign-up only creates students, so the first admin comes from here.
async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("Skipped admin user: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set");
    return;
  }

  if (!(await db.user.findUnique({ where: { email } }))) {
    await auth.api.signUpEmail({
      body: { name: process.env.SEED_ADMIN_NAME ?? "Admin", email, password },
    });
  }

  const admin = await db.user.update({
    where: { email },
    data: { emailVerified: true, role: { connect: { name: "admin" } } },
  });
  // Sign-up opens a session; the seed has no use for it.
  await db.session.deleteMany({ where: { userId: admin.id } });
  console.log(`Seeded admin user: ${email}`);
}

// Development content: the storefront's original sample articles. They have no
// featured image because the old Unsplash photos are not media library rows.
type SamplePost = {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  publishedAt: string;
  featured?: boolean;
  content?: PostBlock[];
};

const samplePosts: SamplePost[] = [
  {
    slug: "in-demand-skills-2025",
    title: "10 In-Demand Skills Employers Are Looking For in 2025",
    category: "Career Advice",
    excerpt:
      "Discover the skills that top UK employers are actively hiring for — and how you can gain them with accredited online training.",
    publishedAt: "12 Sep 2025",
    featured: true,
    content: [
      {
        type: "paragraph",
        text: "The UK job market is evolving faster than ever. With automation, remote work, and digital transformation reshaping industries, employers are rethinking what they look for in candidates.",
      },
      { type: "heading", text: "1. Why Skills Matter More Than Ever" },
      {
        type: "paragraph",
        text: "A decade ago, a degree was often enough to land a solid job. Today, employers care more about what you can actually do.",
      },
      {
        type: "quote",
        text: "“The half-life of a learned skill is now less than five years.” — UK Commission for Employment and Skills",
      },
      { type: "heading", text: "2. Digital & IT Skills" },
      {
        type: "paragraph",
        text: "Digital literacy is no longer optional. The most sought-after digital skills include Microsoft Office proficiency, basic cybersecurity awareness, and data literacy.",
      },
      { type: "image", image: "photo-1460925895917-afdab827c52f" },
      { type: "heading", text: "3. Healthcare & Care Skills" },
      {
        type: "paragraph",
        text: "The UK's health and social care sector is one of the fastest-growing employers, with over 1.5 million vacancies projected by 2030.",
      },
      { type: "heading", text: "4. Soft Skills Employers Value" },
      {
        type: "list",
        items: [
          "Communication",
          "Teamwork",
          "Time management",
          "Problem-solving",
          "Adaptability",
        ],
      },
      { type: "heading", text: "5. How to Gain These Skills" },
      {
        type: "paragraph",
        text: "Accredited online courses give you a fast, flexible, and affordable way to gain recognised qualifications.",
      },
    ],
  },
  {
    slug: "career-in-health-and-social-care",
    title: "How to Start a Career in Health & Social Care in the UK",
    category: "Healthcare",
    excerpt: "From entry-level roles to management paths.",
    publishedAt: "10 Sep 2025",
    featured: true,
  },
  {
    slug: "microsoft-office-skills-for-your-cv",
    title: "Microsoft Office Skills That Will Boost Your CV Instantly",
    category: "IT & Computing",
    excerpt: "Master Excel, Word, and PowerPoint.",
    publishedAt: "08 Sep 2025",
    featured: true,
  },
  {
    slug: "why-workplaces-need-health-and-safety-training",
    title: "Why Every UK Workplace Needs Health & Safety Training",
    category: "Health & Safety",
    excerpt: "It's not just a legal requirement.",
    publishedAt: "06 Sep 2025",
    featured: true,
  },
  {
    slug: "from-team-member-to-manager",
    title: "Leadership Skills: How to Move from Team Member to Manager",
    category: "Business",
    excerpt: "Practical steps to develop leadership capabilities.",
    publishedAt: "04 Sep 2025",
    featured: true,
  },
  {
    slug: "write-a-cv-that-gets-noticed",
    title: "How to Write a CV That Gets You Noticed in 2025",
    category: "Career Advice",
    excerpt:
      "Your CV is your first impression. Learn the latest formatting, keywords, and structure that UK recruiters actually look for.",
    publishedAt: "12 Sep 2025",
  },
  {
    slug: "care-certificate-standards-guide",
    title: "The Complete Guide to the Care Certificate Standards (1-15)",
    category: "Healthcare",
    excerpt:
      "Everything you need to know about the 15 Care Certificate standards — what each one covers and how they're assessed.",
    publishedAt: "05 Sep 2025",
  },
  {
    slug: "excel-formulas-every-office-worker-should-know",
    title: "Excel Formulas Every Office Worker Should Know",
    category: "IT & Computing",
    excerpt:
      "From VLOOKUP to IF statements, master the 15 most useful Excel formulas that will save you hours every week.",
    publishedAt: "28 Aug 2025",
  },
  {
    slug: "common-workplace-hazards",
    title: "5 Common Workplace Hazards (And How to Prevent Them)",
    category: "Health & Safety",
    excerpt:
      "Slips, trips, and manual handling injuries account for the majority of UK workplace accidents.",
    publishedAt: "20 Aug 2025",
  },
  {
    slug: "why-cpd-matters",
    title: "Why CPD Matters: The Benefits of Continuous Professional Development",
    category: "Business",
    excerpt:
      "CPD isn't just a tick-box exercise. Discover how ongoing learning can accelerate your career and boost your salary.",
    publishedAt: "14 Aug 2025",
  },
  {
    slug: "how-to-prepare-for-an-interview",
    title: "How to Prepare for an Interview: 12 Tips That Actually Work",
    category: "Career Advice",
    excerpt:
      "From researching the company to answering tricky questions with confidence — practical advice to help you prepare.",
    publishedAt: "02 Aug 2025",
  },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "12 Sep 2025" as midday UTC.
function parseSampleDate(value: string) {
  const [day, month, year] = value.split(" ");
  return new Date(Date.UTC(Number(year), MONTHS.indexOf(month), Number(day), 12));
}

// Create-only: a sample post that already exists (even if edited since) is left alone.
async function seedBlog() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const author = email ? await db.user.findUnique({ where: { email }, select: { id: true } }) : null;
  let created = 0;
  for (const sample of samplePosts) {
    const categorySlug = slugify(sample.category);
    const category = await db.blogCategory.upsert({
      where: { slug: categorySlug },
      update: {},
      create: { name: sample.category, slug: categorySlug },
    });
    if (await db.blogPost.findUnique({ where: { slug: sample.slug }, select: { id: true } })) continue;
    await db.blogPost.create({
      data: {
        slug: sample.slug,
        title: sample.title,
        excerpt: sample.excerpt,
        body: blocksToDocument(sample.content ?? [{ type: "paragraph", text: sample.excerpt }]) as Prisma.InputJsonValue,
        categoryId: category.id,
        authorId: author?.id ?? null,
        featured: sample.featured ?? false,
        status: "PUBLISHED",
        publishedAt: parseSampleDate(sample.publishedAt),
      },
    });
    created++;
  }
  console.log(`Seeded sample blog posts: ${created} created, ${samplePosts.length - created} already present`);
}

// Development content: sample learners, an instructor and the storefront's
// sample courses (see prisma/seed-courses.ts) with modules, lessons, a few
// enrolments and reviews. Create-only like the blog: an existing course is left
// alone. Skipped in production.
const SAMPLE_PASSWORD = process.env.SEED_SAMPLE_PASSWORD ?? "sample-password-1";

type SampleUser = { email: string; name: string; role: "student" | "instructor"; image?: string; bio?: string };

const instructorUser: SampleUser = {
  email: "helen.brooks@example.com",
  name: "Dr Helen Brooks",
  role: "instructor",
  image: "https://i.pravatar.cc/150?img=47",
  bio: "Helen has taught health, safety and business courses for fifteen years and writes most of the material on this platform.",
};

const learnerUsers: SampleUser[] = [
  { email: "erick.guerrero@example.com", name: "Erick Guerrero", role: "student", image: "https://i.pravatar.cc/150?img=11" },
  { email: "zainab.rizwan@example.com", name: "Zainab Rizwan", role: "student", image: "https://i.pravatar.cc/150?img=32" },
  { email: "sarah.johnson@example.com", name: "Sarah Johnson", role: "student", image: "https://i.pravatar.cc/150?img=5" },
  { email: "james.carter@example.com", name: "James Carter", role: "student", image: "https://i.pravatar.cc/150?img=12" },
];

async function ensureSampleUser(sample: SampleUser) {
  const existing = await db.user.findUnique({ where: { email: sample.email }, select: { id: true } });
  if (existing) return existing.id;
  await auth.api.signUpEmail({ body: { name: sample.name, email: sample.email, password: SAMPLE_PASSWORD } });
  const user = await db.user.update({
    where: { email: sample.email },
    data: {
      emailVerified: true,
      image: sample.image ?? null,
      bio: sample.bio ?? null,
      role: { connect: { name: sample.role } },
    },
  });
  await db.session.deleteMany({ where: { userId: user.id } });
  return user.id;
}

// Learner, course, how it started, lessons finished (a number, or "all") and an optional review.
type SampleEnrolment = {
  learner: string;
  course: string;
  source: "FREE" | "ADMIN";
  done: number | "all";
  review?: { rating: number; title?: string; body: string; status?: "APPROVED" | "PENDING" };
};

const sampleEnrolments: SampleEnrolment[] = [
  {
    learner: "erick.guerrero@example.com",
    course: "barista-training",
    source: "ADMIN",
    done: "all",
    review: {
      rating: 5,
      title: "Great for beginners",
      body: "For knowing absolutely nothing about being a Barista I found this course to be very informative. I definitely recommend this course for beginners.",
    },
  },
  {
    learner: "zainab.rizwan@example.com",
    course: "hr-audit",
    source: "ADMIN",
    done: "all",
    review: {
      rating: 5,
      body: "The HR Audit course was incredibly detailed and practical. It gave me the exact tools I needed to improve our company's HR processes.",
    },
  },
  {
    learner: "sarah.johnson@example.com",
    course: "health-and-social-care-level-3",
    source: "ADMIN",
    done: "all",
    review: {
      rating: 5,
      title: "Boosted my confidence",
      body: "The course was easy to follow and really boosted my confidence. I've now secured a job in care. Highly recommend EdX Learning!",
    },
  },
  {
    learner: "james.carter@example.com",
    course: "health-and-safety-workplace",
    source: "ADMIN",
    done: "all",
    review: {
      rating: 4,
      body: "Excellent support and well-structured content. I gained the skills I needed for my new role. The tutors are incredibly helpful.",
    },
  },
  {
    learner: "sarah.johnson@example.com",
    course: "care-certificate-standards",
    source: "ADMIN",
    done: 5,
    review: { rating: 4, body: "Clear lessons so far. Waiting to finish the last module.", status: "PENDING" },
  },
  { learner: "sarah.johnson@example.com", course: "functional-skills-it", source: "FREE", done: 2 },
  { learner: "james.carter@example.com", course: "functional-skills-it", source: "FREE", done: "all" },
  { learner: "erick.guerrero@example.com", course: "microsoft-office-skills", source: "ADMIN", done: 3 },
  { learner: "zainab.rizwan@example.com", course: "job-search-skills", source: "FREE", done: 0 },
];

async function seedCourses() {
  if (process.env.NODE_ENV === "production") {
    console.log("Skipped sample courses in production");
    return;
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const admin = adminEmail ? await db.user.findUnique({ where: { email: adminEmail }, select: { id: true } }) : null;
  const instructorId = await ensureSampleUser(instructorUser);
  const learnerIds = new Map<string, number>();
  for (const learner of learnerUsers) learnerIds.set(learner.email, await ensureSampleUser(learner));

  // Categories in the order the courses first use them.
  const categoryNames = [...new Set(sampleCourses.map((c) => c.category))];
  const categories = new Map<string, number>();
  for (const [index, name] of categoryNames.entries()) {
    const slug = slugify(name);
    const category = await db.courseCategory.upsert({
      where: { slug },
      update: {},
      create: { name, slug, sortOrder: index },
    });
    categories.set(name, category.id);
  }
  const tagNames = [...new Set(sampleCourses.flatMap((c) => c.tags ?? []))];
  const tags = new Map<string, number>();
  for (const name of tagNames) {
    const slug = slugify(name);
    const tag = await db.courseTag.upsert({ where: { slug }, update: {}, create: { name, slug } });
    tags.set(name, tag.id);
  }

  let created = 0;
  for (const sample of sampleCourses) {
    if (await db.course.findUnique({ where: { slug: sample.slug }, select: { id: true } })) continue;

    const usedSlugs = new Set<string>();
    const lessonSlug = (title: string) => {
      const base = slugify(title) || "lesson";
      let slug = base;
      for (let n = 2; usedSlugs.has(slug); n++) slug = `${base}-${n}`;
      usedSlugs.add(slug);
      return slug;
    };
    const publishedAt = new Date(Date.now() - sample.publishedDaysAgo * 24 * 60 * 60 * 1000);
    publishedAt.setUTCHours(12, 0, 0, 0);

    await db.course.create({
      data: {
        slug: sample.slug,
        title: sample.title,
        subtitle: sample.summary ?? null,
        shortDescription: sample.shortDescription ?? null,
        description: blocksToDocument([
          { type: "paragraph", text: sample.shortDescription ?? sample.summary ?? sample.title },
          { type: "heading", text: "Who is this course for?" },
          {
            type: "paragraph",
            text: "Anyone who wants a clear, flexible introduction to the subject. No previous experience is needed, and you can study at your own pace on any device.",
          },
        ]) as Prisma.InputJsonValue,
        externalImageId: sample.image,
        price: sample.price,
        compareAtPrice: sample.oldPrice ?? null,
        level: sample.level ?? "ALL_LEVELS",
        durationMinutes: sample.minutes ?? null,
        badge: sample.badge ?? null,
        featured: sample.featured ?? false,
        instructorId,
        createdById: admin?.id ?? null,
        categoryId: categories.get(sample.category),
        tags: { create: (sample.tags ?? []).map((name) => ({ tagId: tags.get(name)! })) },
        status: "PUBLISHED",
        publishedAt,
        modules: {
          create: (sample.modules ?? genericModules(sample.title)).map((module, moduleIndex) => ({
            title: module.title,
            description: module.description ?? null,
            position: moduleIndex + 1,
            lessons: {
              create: module.lessons.map((lesson, lessonIndex) => ({
                // Lessons carry the course id too, which the nested create cannot
                // infer through the module, so it is connected explicitly below.
                course: { connect: { slug: sample.slug } },
                title: lesson.title,
                slug: lessonSlug(lesson.title),
                type: lesson.type,
                content: lesson.text ? (blocksToDocument(lesson.text) as Prisma.InputJsonValue) : undefined,
                durationSeconds: lesson.minutes * 60,
                position: lessonIndex + 1,
                isFreePreview: lesson.preview ?? false,
                quiz:
                  lesson.type === "QUIZ" && sample.quiz
                    ? {
                        create: {
                          passingScore: 70,
                          attemptLimit: 3,
                          timeLimitMinutes: lesson.minutes,
                          passFeedback: "Well done, you passed.",
                          failFeedback: "Not quite there yet. Review the lessons and try again.",
                          questions: {
                            create: sample.quiz.map((question, questionIndex) => ({
                              type: question.type,
                              text: question.text,
                              explanation: question.explanation ?? null,
                              points: 1,
                              position: questionIndex + 1,
                              options: question.options.map((text, i) => ({
                                id: String.fromCharCode(97 + i),
                                text,
                                correct: question.correct.includes(i),
                              })),
                            })),
                          },
                        },
                      }
                    : undefined,
              })),
            },
          })),
        },
      },
    });
    created++;
  }
  console.log(`Seeded sample courses: ${created} created, ${sampleCourses.length - created} already present`);

  let enrolled = 0;
  for (const sample of sampleEnrolments) {
    const userId = learnerIds.get(sample.learner);
    const course = await db.course.findUnique({
      where: { slug: sample.course },
      select: { id: true, lessons: { orderBy: [{ module: { position: "asc" } }, { position: "asc" }], select: { id: true } } },
    });
    if (!userId || !course) continue;
    if (await db.enrolment.findUnique({ where: { userId_courseId: { userId, courseId: course.id } }, select: { id: true } })) continue;

    const total = course.lessons.length;
    const done = sample.done === "all" ? total : Math.min(sample.done, total);
    const finished = done === total && total > 0;
    const enrolledAt = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    await db.enrolment.create({
      data: {
        userId,
        courseId: course.id,
        source: sample.source,
        status: finished ? "COMPLETED" : "ACTIVE",
        enrolledAt,
        completedAt: finished ? new Date() : null,
        assignedById: sample.source === "ADMIN" ? (admin?.id ?? null) : null,
        progressPercent: total > 0 ? Math.round((done / total) * 100) : 0,
        lastLessonId: done > 0 ? course.lessons[done - 1].id : null,
        progress: { create: course.lessons.slice(0, done).map((lesson) => ({ lessonId: lesson.id, completedAt: new Date() })) },
      },
    });
    if (sample.review) {
      await db.courseReview.create({
        data: {
          userId,
          courseId: course.id,
          rating: sample.review.rating,
          title: sample.review.title ?? null,
          body: sample.review.body,
          status: sample.review.status ?? "APPROVED",
          moderatedById: sample.review.status === "PENDING" ? null : (admin?.id ?? null),
          moderatedAt: sample.review.status === "PENDING" ? null : new Date(),
        },
      });
    }
    enrolled++;
  }
  // Completed sample enrolments get the certificate they would have earned.
  const certificates = await backfillCertificateRecords();
  console.log(`Issued ${certificates.length} certificate${certificates.length === 1 ? "" : "s"} for completed enrolments`);
  console.log(
    `Seeded sample enrolments: ${enrolled} created. Sample accounts (instructor and learners) use password "${SAMPLE_PASSWORD}"`,
  );
}

// Development content: coupons that exercise every rule (see src/lib/commerce.ts).
// Create-only by code, so edits made since stay. Skipped in production.
type SampleCoupon = {
  code: string;
  description: string;
  discountType: "PERCENTAGE" | "FIXED";
  value: number;
  usageLimit?: number;
  perUserLimit?: number;
  minSpend?: number;
  // Days from now; negative is in the past.
  startsInDays?: number;
  expiresInDays?: number;
  courses?: string[];
  categories?: string[];
};

const sampleCoupons: SampleCoupon[] = [
  { code: "WELCOME10", description: "10% off, once per learner", discountType: "PERCENTAGE", value: 10, perUserLimit: 1 },
  { code: "SAVE5", description: "£5 off orders of £20 or more", discountType: "FIXED", value: 5, minSpend: 20 },
  {
    code: "HEALTHCARE20",
    description: "20% off Healthcare courses and the Excel course",
    discountType: "PERCENTAGE",
    value: 20,
    categories: ["healthcare"],
    courses: ["microsoft-excel-complete"],
  },
  { code: "EXPIRED50", description: "50% off, ended a month ago", discountType: "PERCENTAGE", value: 50, startsInDays: -60, expiresInDays: -30 },
  { code: "LAUNCH100", description: "100% off for testing free orders: 5 uses, once each", discountType: "PERCENTAGE", value: 100, usageLimit: 5, perUserLimit: 1 },
];

async function seedCoupons() {
  if (process.env.NODE_ENV === "production") {
    console.log("Skipped sample coupons in production");
    return;
  }
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const admin = adminEmail ? await db.user.findUnique({ where: { email: adminEmail }, select: { id: true } }) : null;
  const day = 24 * 60 * 60 * 1000;
  let created = 0;
  for (const sample of sampleCoupons) {
    if (await db.coupon.findUnique({ where: { code: sample.code }, select: { id: true } })) continue;
    const courses = await db.course.findMany({ where: { slug: { in: sample.courses ?? [] } }, select: { id: true } });
    const categories = await db.courseCategory.findMany({ where: { slug: { in: sample.categories ?? [] } }, select: { id: true } });
    await db.coupon.create({
      data: {
        code: sample.code,
        description: sample.description,
        internalNote: "Sample coupon from the development seed.",
        discountType: sample.discountType,
        value: sample.value,
        usageLimit: sample.usageLimit ?? null,
        perUserLimit: sample.perUserLimit ?? null,
        minSpend: sample.minSpend ?? null,
        startsAt: sample.startsInDays === undefined ? null : new Date(Date.now() + sample.startsInDays * day),
        expiresAt: sample.expiresInDays === undefined ? null : new Date(Date.now() + sample.expiresInDays * day),
        createdById: admin?.id ?? null,
        courses: { create: courses.map((c) => ({ courseId: c.id })) },
        categories: { create: categories.map((c) => ({ categoryId: c.id })) },
      },
    });
    created++;
  }
  console.log(`Seeded sample coupons: ${created} created, ${sampleCoupons.length - created} already present`);
}

// Development content: a handful of orders for the sample learners, so the
// order and coupon screens are not empty. They are marked as samples (order
// numbers contain SAMP, the first timeline entry says so) and carry no Stripe
// ids, so nothing mistakes them for real payments. Create-only by order number
// suffix. Run after seedCourses and seedCoupons. Skipped in production.
type SampleOrder = {
  // Last part of the order number, e.g. SAMPA2.
  key: string;
  learner: string;
  courses: string[];
  status: "PAID" | "PENDING" | "FAILED" | "CANCELLED";
  coupon?: string;
  // How long ago it was placed.
  minutesAgo: number;
  card?: { brand: string; last4: string };
  failure?: string;
};

const sampleOrders: SampleOrder[] = [
  { key: "SAMPA2", learner: "erick.guerrero@example.com", courses: ["microsoft-excel-complete"], status: "PAID", minutesAgo: 12 * 1440, card: { brand: "visa", last4: "4242" } },
  { key: "SAMPA3", learner: "zainab.rizwan@example.com", courses: ["care-certificate-standards", "medical-administration"], status: "PAID", coupon: "WELCOME10", minutesAgo: 8 * 1440 + 200, card: { brand: "mastercard", last4: "4444" } },
  { key: "SAMPA4", learner: "james.carter@example.com", courses: ["hr-audit"], status: "PAID", minutesAgo: 3 * 1440 + 90, card: { brand: "visa", last4: "1881" } },
  { key: "SAMPA5", learner: "sarah.johnson@example.com", courses: ["leadership-management-level-5"], status: "PENDING", minutesAgo: 25 },
  { key: "SAMPA6", learner: "erick.guerrero@example.com", courses: ["business-administration-level-3"], status: "FAILED", minutesAgo: 5 * 1440, card: { brand: "visa", last4: "0002" }, failure: "Sample failure: the card was declined." },
  { key: "SAMPA7", learner: "james.carter@example.com", courses: ["construction-health-safety"], status: "CANCELLED", coupon: "SAVE5", minutesAgo: 2 * 1440 + 400 },
];

async function seedOrders() {
  if (process.env.NODE_ENV === "production") {
    console.log("Skipped sample orders in production");
    return;
  }
  const admin = process.env.SEED_ADMIN_EMAIL
    ? await db.user.findUnique({ where: { email: process.env.SEED_ADMIN_EMAIL }, select: { id: true, name: true } })
    : null;
  let created = 0;
  for (const sample of sampleOrders) {
    if (await db.order.findFirst({ where: { orderNumber: { endsWith: `-${sample.key}` } }, select: { id: true } })) continue;
    const user = await db.user.findUnique({ where: { email: sample.learner }, select: { id: true, name: true, email: true } });
    const courses = await db.course.findMany({ where: { slug: { in: sample.courses } }, select: { id: true, title: true, price: true, categoryId: true } });
    const coupon = sample.coupon ? await db.coupon.findUnique({ where: { code: sample.coupon }, select: { id: true, discountType: true, value: true } }) : null;
    if (!user || courses.length !== sample.courses.length || (sample.coupon && !coupon)) continue;

    const lines = courses.map((c) => ({ courseId: c.id, categoryId: c.categoryId, pricePence: toPence(Number(c.price)) }));
    if (lines.some((l) => l.pricePence <= 0)) continue;
    const pricing = priceOrder(lines, coupon ? calculateCouponDiscount({ discountType: coupon.discountType, value: Number(coupon.value), courseIds: [], categoryIds: [] }, lines) : undefined);
    const placedAt = new Date(Date.now() - sample.minutesAgo * 60_000);
    const at = (minutesAfter: number) => new Date(placedAt.getTime() + minutesAfter * 60_000);
    const [firstName, ...rest] = user.name.split(" ");
    const paid = sample.status === "PAID";

    const order = await db.order.create({
      data: {
        orderNumber: `ORD-${placedAt.toISOString().slice(0, 10).replaceAll("-", "")}-${sample.key}`,
        userId: user.id,
        status: sample.status,
        subtotal: toPounds(pricing.subtotalPence),
        discountTotal: toPounds(pricing.discountPence),
        total: toPounds(pricing.totalPence),
        couponId: coupon?.id ?? null,
        couponCode: sample.coupon ?? null,
        billingFirstName: firstName,
        billingLastName: rest.join(" ") || firstName,
        billingAddressLine1: "1 Sample Street",
        billingCity: "London",
        billingPostcode: "SW1A 1AA",
        email: user.email,
        paidAt: paid ? at(2) : null,
        cancelledAt: sample.status === "CANCELLED" ? at(90) : null,
        createdAt: placedAt,
        items: {
          create: courses.map((course, i) => ({
            courseId: course.id,
            courseTitle: course.title,
            unitPrice: toPounds(pricing.lines[i].pricePence),
            discount: toPounds(pricing.lines[i].discountPence),
            total: toPounds(pricing.lines[i].totalPence),
          })),
        },
      },
      select: { id: true, items: { select: { id: true, courseId: true } } },
    });

    const events: { type: "CREATED" | "PAYMENT_STARTED" | "PAID" | "ENROLLED" | "FAILED" | "CANCELLED" | "COUPON_RELEASED"; message: string; minutes: number; actorId?: number | null }[] = [
      { type: "CREATED", message: "Order placed. This is a sample order from the development seed, not a real payment.", minutes: 0 },
    ];
    if (sample.status !== "CANCELLED") {
      events.push({ type: "PAYMENT_STARTED", message: "Sample payment started.", minutes: 1 });
    }
    if (paid) events.push({ type: "PAID", message: `Sample payment of £${toPounds(pricing.totalPence).toFixed(2)} recorded.`, minutes: 2 });
    if (sample.status === "FAILED") events.push({ type: "FAILED", message: sample.failure ?? "Sample payment failed.", minutes: 3 });
    if (sample.status === "CANCELLED") {
      events.push({ type: "CANCELLED", message: `Cancelled by ${admin?.name ?? "staff"}.`, minutes: 90, actorId: admin?.id });
    }
    if (coupon && sample.status === "CANCELLED") events.push({ type: "COUPON_RELEASED", message: `Coupon use given back (${sample.coupon}).`, minutes: 90, actorId: admin?.id });

    if (paid) {
      // Access: reuse an enrolment the seed already made, else create an order-sourced one.
      const enrolledTitles: string[] = [];
      for (const item of order.items) {
        const existing = await db.enrolment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: item.courseId } }, select: { id: true } });
        const enrolment = existing ?? (await db.enrolment.create({ data: { userId: user.id, courseId: item.courseId, source: "ORDER", enrolledAt: at(2) }, select: { id: true } }));
        await db.orderItem.update({ where: { id: item.id }, data: { enrolmentId: enrolment.id } });
        enrolledTitles.push(courses.find((c) => c.id === item.courseId)!.title);
      }
      events.push({ type: "ENROLLED", message: `Learner enrolled in ${enrolledTitles.join(", ")}.`, minutes: 2 });
    }

    // The payment attempt: no Stripe ids, so it can never be mistaken for a real one.
    if (sample.status !== "CANCELLED") {
      await db.payment.create({
        data: {
          orderId: order.id,
          provider: "STRIPE",
          status: paid ? "SUCCEEDED" : sample.status === "FAILED" ? "FAILED" : "PENDING",
          amount: toPounds(pricing.totalPence),
          cardBrand: sample.card?.brand ?? null,
          cardLast4: sample.card?.last4 ?? null,
          failureMessage: sample.failure ?? null,
          paidAt: paid ? at(2) : null,
          createdAt: at(1),
        },
      });
    }
    if (coupon) {
      await db.couponRedemption.create({
        data: { couponId: coupon.id, userId: user.id, orderId: order.id, createdAt: placedAt, releasedAt: sample.status === "CANCELLED" ? at(90) : null },
      });
    }
    for (const event of events) {
      await db.orderEvent.create({ data: { orderId: order.id, type: event.type, message: event.message, actorId: event.actorId ?? null, createdAt: at(event.minutes) } });
    }
    created++;
  }
  console.log(`Seeded sample orders: ${created} created, ${sampleOrders.length - created} already present or skipped`);
}

async function main() {
  for (const role of roles) {
    await db.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }
  console.log(`Seeded ${roles.length} roles: ${roles.map((r) => r.name).join(", ")}`);

  await seedPermissions();
  await seedAdmin();
  await seedBlog();
  await seedCourses();
  await seedCoupons();
  await seedOrders();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
