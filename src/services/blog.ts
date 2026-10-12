import "server-only";

// Placeholder articles from the design, until the blog module exists.

export type PostBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "quote"; text: string }
  | { type: "image"; image: string }
  | { type: "list"; items: string[] };

export type Post = {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  image: string;
  readTime: string;
  publishedAt: string;
  author: { name: string; avatar: string };
  featured?: boolean;
  content?: PostBlock[];
};

const author = { name: "Sarah Mitchell", avatar: "https://i.pravatar.cc/100?img=5" };

const posts: Post[] = [
  {
    slug: "in-demand-skills-2025",
    title: "10 In-Demand Skills Employers Are Looking For in 2025",
    category: "Career Advice",
    excerpt:
      "Discover the skills that top UK employers are actively hiring for — and how you can gain them with accredited online training.",
    image: "photo-1522202176988-66273c2fd55f",
    readTime: "8 min read",
    publishedAt: "12 Sep 2025",
    author,
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
    image: "photo-1576091160399-112ba8d25d1d",
    readTime: "9 min read",
    publishedAt: "10 Sep 2025",
    author,
    featured: true,
  },
  {
    slug: "microsoft-office-skills-for-your-cv",
    title: "Microsoft Office Skills That Will Boost Your CV Instantly",
    category: "IT & Computing",
    excerpt: "Master Excel, Word, and PowerPoint.",
    image: "photo-1516321318423-f06f85e504b3",
    readTime: "6 min read",
    publishedAt: "08 Sep 2025",
    author,
    featured: true,
  },
  {
    slug: "why-workplaces-need-health-and-safety-training",
    title: "Why Every UK Workplace Needs Health & Safety Training",
    category: "Health & Safety",
    excerpt: "It's not just a legal requirement.",
    image: "photo-1504307651254-35680f356dfd",
    readTime: "7 min read",
    publishedAt: "06 Sep 2025",
    author,
    featured: true,
  },
  {
    slug: "from-team-member-to-manager",
    title: "Leadership Skills: How to Move from Team Member to Manager",
    category: "Business",
    excerpt: "Practical steps to develop leadership capabilities.",
    image: "photo-1556761175-5973dc0f32e7",
    readTime: "8 min read",
    publishedAt: "04 Sep 2025",
    author,
    featured: true,
  },
  {
    slug: "write-a-cv-that-gets-noticed",
    title: "How to Write a CV That Gets You Noticed in 2025",
    category: "Career Advice",
    excerpt:
      "Your CV is your first impression. Learn the latest formatting, keywords, and structure that UK recruiters actually look for.",
    image: "photo-1586281380349-632531db7ed4",
    readTime: "7 min read",
    publishedAt: "12 Sep 2025",
    author,
  },
  {
    slug: "care-certificate-standards-guide",
    title: "The Complete Guide to the Care Certificate Standards (1-15)",
    category: "Healthcare",
    excerpt:
      "Everything you need to know about the 15 Care Certificate standards — what each one covers and how they're assessed.",
    image: "photo-1576091160550-2173dba999ef",
    readTime: "10 min read",
    publishedAt: "05 Sep 2025",
    author,
  },
  {
    slug: "excel-formulas-every-office-worker-should-know",
    title: "Excel Formulas Every Office Worker Should Know",
    category: "IT & Computing",
    excerpt:
      "From VLOOKUP to IF statements, master the 15 most useful Excel formulas that will save you hours every week.",
    image: "photo-1460925895917-afdab827c52f",
    readTime: "8 min read",
    publishedAt: "28 Aug 2025",
    author,
  },
  {
    slug: "common-workplace-hazards",
    title: "5 Common Workplace Hazards (And How to Prevent Them)",
    category: "Health & Safety",
    excerpt:
      "Slips, trips, and manual handling injuries account for the majority of UK workplace accidents.",
    image: "photo-1504307651254-35680f356dfd",
    readTime: "6 min read",
    publishedAt: "20 Aug 2025",
    author,
  },
  {
    slug: "why-cpd-matters",
    title: "Why CPD Matters: The Benefits of Continuous Professional Development",
    category: "Business",
    excerpt:
      "CPD isn't just a tick-box exercise. Discover how ongoing learning can accelerate your career and boost your salary.",
    image: "photo-1552664730-d307ca884978",
    readTime: "9 min read",
    publishedAt: "14 Aug 2025",
    author,
  },
  {
    slug: "how-to-prepare-for-an-interview",
    title: "How to Prepare for an Interview: 12 Tips That Actually Work",
    category: "Career Advice",
    excerpt:
      "From researching the company to answering tricky questions with confidence — practical advice to help you prepare.",
    image: "photo-1551836022-d5d88e9218df",
    readTime: "11 min read",
    publishedAt: "02 Aug 2025",
    author,
  },
];

export async function getFeaturedPosts() {
  return posts.filter((post) => post.featured);
}

export async function getLatestPosts() {
  return posts.filter((post) => !post.featured);
}

export async function getPostBySlug(slug: string) {
  return posts.find((post) => post.slug === slug) ?? null;
}
