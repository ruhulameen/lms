import "dotenv/config";
import { auth } from "../src/lib/auth";
import type { Prisma } from "../src/generated/prisma/client";
import { db } from "../src/lib/db";
import { allPermissions } from "../src/lib/permissions";
import { blocksToDocument, type PostBlock } from "../src/lib/rich-text";
import { slugify } from "../src/lib/slug";

// `student` and `instructor` are reserved names: panel routing depends on them.
const roles = [
  { name: "student", description: "Learner enrolled in courses" },
  { name: "instructor", description: "Creates and teaches courses" },
  { name: "admin", description: "Full access to the admin panel" },
];

// Keeps the permission table equal to the list in src/lib/permissions.ts.
async function seedPermissions() {
  for (const permission of allPermissions) {
    await db.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: { key: permission.key, description: permission.description },
    });
  }
  const { count } = await db.permission.deleteMany({
    where: { key: { notIn: allPermissions.map((p) => p.key) } },
  });
  console.log(
    `Seeded ${allPermissions.length} permissions` +
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
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
