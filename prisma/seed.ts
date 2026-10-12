import "dotenv/config";
import { auth } from "../src/lib/auth";
import type { Prisma } from "../src/generated/prisma/client";
import { backfillCertificateRecords } from "../src/lib/certificate-issue";
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
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
