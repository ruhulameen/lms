import "server-only";

// Placeholder catalogue: sample content from the design, served through the
// service so pages keep working unchanged once courses live in the database.

export type Course = {
  slug: string;
  title: string;
  image: string;
  category: string;
  summary?: string;
  reviews: number;
  students?: number;
  duration?: string;
  price: number;
  oldPrice?: number;
  badge?: string;
};

export type Deal = Course & { discount: string };

const courses: Course[] = [
  {
    slug: "microsoft-office-skills",
    title: "Microsoft Office Skills (Microsoft Excel, Word, PowerPoint)",
    image: "photo-1516321318423-f06f85e504b3",
    category: "IT & Computing",
    summary: "15 CPD Courses Bundle | Level 7 QLS Endorsed",
    reviews: 4629,
    students: 5309,
    duration: "10 hours",
    price: 22,
    oldPrice: 199,
    badge: "Best Seller",
  },
  {
    slug: "care-certificate-standards",
    title:
      "Level 1 Certificate in Health and Social Care + Care Certificate Standards",
    image: "photo-1576091160399-112ba8d25d1d",
    category: "Healthcare",
    summary:
      "3,000+ Students | CPD Certified | Care Certificate Standards (1-15)",
    reviews: 4103,
    students: 8201,
    duration: "5 hours",
    price: 28,
    oldPrice: 199,
    badge: "Great service",
  },
  {
    slug: "teaching-assistant-level-1-2-3",
    title:
      "Teaching Assistant Level 1, 2 & 3 + Early Years, SEN, Primary Teaching & Child Care",
    image: "photo-1587654780291-39c9404d746b",
    category: "Teaching",
    summary: "6 Courses | CPD Certified | Institute of Hospitality Endorsed",
    reviews: 4109,
    students: 6736,
    duration: "4 hours",
    price: 15,
    oldPrice: 299,
    badge: "Great service",
  },
  {
    slug: "health-and-social-care-level-5",
    title:
      "Level 5 Certificate in Health and Social Care + Care Certificate Standards (1 to 15)",
    image: "photo-1532938911079-1b06ac7ceec7",
    category: "Healthcare",
    summary: "15 CPD Courses Bundle | 1200+ Training Hours",
    reviews: 4186,
    students: 9420,
    duration: "8 hours",
    price: 15,
    oldPrice: 199,
    badge: "Great service",
  },
  {
    slug: "microsoft-excel-complete",
    title:
      "Microsoft Excel Complete Course - Beginner, Intermediate & Advanced (Updated 2025)",
    image: "photo-1516321318423-f06f85e504b3",
    category: "IT & Computing",
    summary: "5 Courses Bundle + Free PDF Certificate | 300+ Video Training",
    reviews: 4459,
    students: 6205,
    duration: "10 hours",
    price: 15,
    oldPrice: 199,
    badge: "Best Seller",
  },
  {
    slug: "health-and-social-care-level-3",
    title: "Level 3 Diploma in Health and Social Care",
    image: "photo-1576091160399-112ba8d25d1d",
    category: "Health & Social Care",
    reviews: 4582,
    students: 4582,
    price: 21.99,
  },
  {
    slug: "health-and-safety-workplace",
    title: "Health and Safety in the Workplace (High Risk)",
    image: "photo-1504307651254-35680f356dfd",
    category: "Health & Safety",
    reviews: 4201,
    students: 4201,
    price: 21.99,
  },
  {
    slug: "childcare-early-years-level-2",
    title: "Level 2 Certificate in Childcare and Early Years",
    image: "photo-1587654780291-39c9404d746b",
    category: "Teaching",
    reviews: 4058,
    price: 21.99,
  },
  {
    slug: "microsoft-office-365",
    title: "Microsoft Office 365 (Word, Excel, PowerPoint)",
    image: "photo-1516321318423-f06f85e504b3",
    category: "IT & Computing",
    reviews: 4512,
    price: 19.99,
  },
  {
    slug: "medical-administration",
    title: "Medical Administration and Reception Skills",
    image: "photo-1532938911079-1b06ac7ceec7",
    category: "Healthcare",
    reviews: 4102,
    price: 21.99,
  },
  {
    slug: "leadership-management-level-5",
    title: "Level 5 Diploma in Leadership and Management",
    image: "photo-1556761175-5973dc0f32e7",
    category: "Business",
    reviews: 4015,
    price: 24.99,
  },
  {
    slug: "construction-health-safety",
    title: "Construction Health & Safety (SSSTS)",
    image: "photo-1541888946425-d81bb19240f5",
    category: "Construction",
    reviews: 4018,
    price: 19.99,
  },
  {
    slug: "business-administration-level-3",
    title: "Level 3 Diploma in Business Administration",
    image: "photo-1454165804606-c3d57bc86b40",
    category: "Business",
    reviews: 4097,
    price: 21.99,
  },
  {
    slug: "hr-audit",
    title: "Human Resources (HR) Audit",
    image: "photo-1551836022-d5d88e9218df",
    category: "Business",
    reviews: 4097,
    students: 74,
    price: 21.99,
  },
  {
    slug: "barista-training",
    title: "Barista Training",
    image: "photo-1513558161293-cdaf765ed2fd",
    category: "Hospitality",
    reviews: 142,
    students: 142,
    price: 19.99,
  },
  {
    slug: "functional-skills-it",
    title: "Functional Skills IT",
    image: "photo-1516321318423-f06f85e504b3",
    category: "IT & Computing",
    reviews: 2140,
    price: 0,
    oldPrice: 14.99,
  },
  {
    slug: "business-information-communication",
    title: "Business Information & Communication",
    image: "photo-1521737711867-e3b97375f902",
    category: "Business",
    reviews: 1830,
    price: 0,
    oldPrice: 19.99,
  },
  {
    slug: "basic-english-for-business",
    title: "Basic English for Business",
    image: "photo-1544717297-fa95b6ee9643",
    category: "Language",
    reviews: 1520,
    price: 0,
    oldPrice: 14.99,
  },
  {
    slug: "job-search-skills",
    title: "Job Search Skills",
    image: "photo-1486312338219-ce68d2c6f44d",
    category: "Career",
    reviews: 2410,
    price: 0,
    oldPrice: 16.99,
  },
];

const FEATURED = [
  "health-and-social-care-level-3",
  "health-and-safety-workplace",
  "childcare-early-years-level-2",
  "microsoft-office-365",
  "medical-administration",
  "leadership-management-level-5",
  "construction-health-safety",
  "business-administration-level-3",
];

const RECOMMENDED = [
  "microsoft-office-skills",
  "care-certificate-standards",
  "teaching-assistant-level-1-2-3",
  "health-and-safety-workplace",
  "hr-audit",
];

const DEALS: { slug: string; price: number; oldPrice: number; discount: string }[] = [
  { slug: "microsoft-office-skills", price: 2.49, oldPrice: 24.99, discount: "90" },
  { slug: "care-certificate-standards", price: 2.8, oldPrice: 28, discount: "90" },
  { slug: "teaching-assistant-level-1-2-3", price: 1.5, oldPrice: 15, discount: "90" },
  { slug: "health-and-safety-workplace", price: 1.99, oldPrice: 19.99, discount: "90" },
  { slug: "hr-audit", price: 4.4, oldPrice: 21.99, discount: "80" },
  { slug: "leadership-management-level-5", price: 5, oldPrice: 24.99, discount: "80" },
  { slug: "medical-administration", price: 4.4, oldPrice: 21.99, discount: "80" },
  { slug: "construction-health-safety", price: 4, oldPrice: 19.99, discount: "80" },
];

function pick(slugs: string[]) {
  return slugs.flatMap((slug) => courses.find((c) => c.slug === slug) ?? []);
}

export async function getCourses(query = "") {
  const term = query.trim().toLowerCase();
  return courses.filter(
    (course) =>
      course.price > 0 &&
      (course.title.toLowerCase().includes(term) ||
        course.category.toLowerCase().includes(term)),
  );
}

export async function getCourseBySlug(slug: string) {
  return courses.find((course) => course.slug === slug) ?? null;
}

export async function getFeaturedCourses() {
  return pick(FEATURED);
}

export async function getRecommendedCourses() {
  return pick(RECOMMENDED);
}

export async function getFreeCourses() {
  return courses.filter((course) => course.price === 0);
}

export async function getDeals(discount: "90" | "80"): Promise<Deal[]> {
  return DEALS.filter((deal) => deal.discount === discount).flatMap((deal) => {
    const course = courses.find((c) => c.slug === deal.slug);
    return course ? { ...course, ...deal } : [];
  });
}
