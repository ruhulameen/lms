import type { PostBlock } from "../src/lib/rich-text";

// Development content for the course catalogue: the storefront's original
// sample courses (images are Unsplash photo ids, kept as `externalImageId`),
// with a few modules and lessons each. Read by seedCourses in seed.ts.

export type SampleLesson = {
  title: string;
  type: "VIDEO" | "TEXT" | "DOCUMENT" | "QUIZ";
  minutes: number;
  preview?: boolean;
  text?: PostBlock[];
};

export type SampleModule = { title: string; description?: string; lessons: SampleLesson[] };

export type SampleQuestion = {
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  text: string;
  explanation?: string;
  // Indexes of the correct options.
  correct: number[];
  options: string[];
};

export type SampleCourse = {
  slug: string;
  title: string;
  image: string;
  category: string;
  summary?: string;
  shortDescription?: string;
  price: number;
  oldPrice?: number;
  badge?: string;
  // Course length in minutes.
  minutes?: number;
  level?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "ALL_LEVELS";
  featured?: boolean;
  tags?: string[];
  modules?: SampleModule[];
  quiz?: SampleQuestion[];
  // Days before today the course was published.
  publishedDaysAgo: number;
};

export const sampleCourses: SampleCourse[] = [
  {
    slug: "microsoft-office-skills",
    title: "Microsoft Office Skills (Microsoft Excel, Word, PowerPoint)",
    image: "photo-1516321318423-f06f85e504b3",
    category: "IT & Computing",
    summary: "15 CPD Courses Bundle | Level 7 QLS Endorsed",
    shortDescription: "Build confident everyday skills in Excel, Word and PowerPoint with short video lessons and practice files.",
    price: 22,
    oldPrice: 199,
    badge: "Best Seller",
    minutes: 600,
    level: "BEGINNER",
    tags: ["Microsoft Office", "CPD"],
    publishedDaysAgo: 120,
    modules: [
      {
        title: "Getting started with Office",
        lessons: [
          { title: "Welcome to the course", type: "VIDEO", minutes: 4, preview: true },
          {
            title: "How this course works",
            type: "TEXT",
            minutes: 5,
            preview: true,
            text: [
              { type: "paragraph", text: "This course is split into short modules. Watch the video lessons, try the exercises in your own copy of Office, and finish each module with a quick recap." },
              { type: "list", items: ["Study at your own pace", "Download the practice files", "Take the final quiz when you are ready"] },
            ],
          },
          { title: "Practice files", type: "DOCUMENT", minutes: 2 },
        ],
      },
      {
        title: "Microsoft Excel essentials",
        lessons: [
          { title: "Cells, rows and columns", type: "VIDEO", minutes: 14 },
          { title: "Your first formulas", type: "VIDEO", minutes: 18 },
          {
            title: "Formula cheat sheet",
            type: "TEXT",
            minutes: 6,
            text: [
              { type: "heading", text: "Formulas worth knowing" },
              { type: "list", items: ["SUM adds a range of cells", "AVERAGE finds the mean", "IF returns one value or another", "VLOOKUP finds a value in a table"] },
            ],
          },
        ],
      },
      {
        title: "Word and PowerPoint",
        lessons: [
          { title: "Formatting a professional document", type: "VIDEO", minutes: 16 },
          { title: "Building a clear presentation", type: "VIDEO", minutes: 15 },
          { title: "Final quiz", type: "QUIZ", minutes: 10 },
        ],
      },
    ],
    quiz: [
      {
        type: "SINGLE_CHOICE",
        text: "Which Excel function adds up a range of cells?",
        explanation: "SUM adds every number in the range you give it.",
        correct: [0],
        options: ["SUM", "COUNTA", "CONCAT", "ROUND"],
      },
      {
        type: "TRUE_FALSE",
        text: "A formula in Excel always starts with an equals sign.",
        correct: [0],
        options: ["True", "False"],
      },
      {
        type: "MULTIPLE_CHOICE",
        text: "Which of these are PowerPoint features?",
        correct: [0, 2],
        options: ["Slide transitions", "Pivot tables", "Speaker notes", "Mail merge"],
      },
    ],
  },
  {
    slug: "care-certificate-standards",
    title: "Level 1 Certificate in Health and Social Care + Care Certificate Standards",
    image: "photo-1576091160399-112ba8d25d1d",
    category: "Healthcare",
    summary: "3,000+ Students | CPD Certified | Care Certificate Standards (1-15)",
    shortDescription: "An introduction to working in care, covering the fifteen Care Certificate standards.",
    price: 28,
    oldPrice: 199,
    badge: "Great service",
    minutes: 300,
    level: "BEGINNER",
    tags: ["Care", "CPD"],
    publishedDaysAgo: 110,
    modules: [
      {
        title: "Understanding your role",
        lessons: [
          { title: "Welcome and course overview", type: "VIDEO", minutes: 5, preview: true },
          {
            title: "What the Care Certificate covers",
            type: "TEXT",
            minutes: 8,
            preview: true,
            text: [
              { type: "paragraph", text: "The Care Certificate is a set of fifteen standards that health and social care workers are expected to meet when they start a new role." },
              { type: "heading", text: "Standards at a glance" },
              { type: "list", items: ["Understand your role", "Your personal development", "Duty of care", "Equality and diversity", "Work in a person-centred way"] },
            ],
          },
          { title: "Standards checklist", type: "DOCUMENT", minutes: 3 },
        ],
      },
      {
        title: "Safeguarding and communication",
        lessons: [
          { title: "Safeguarding adults", type: "VIDEO", minutes: 20 },
          { title: "Communicating with sensitivity", type: "VIDEO", minutes: 17 },
          { title: "Handling information safely", type: "TEXT", minutes: 7, text: [{ type: "paragraph", text: "Information about the people you support is confidential. Share it only with those who need it, and record it accurately and promptly." }] },
        ],
      },
      {
        title: "Health, safety and wellbeing",
        lessons: [
          { title: "Infection prevention and control", type: "VIDEO", minutes: 18 },
          { title: "Moving and handling basics", type: "VIDEO", minutes: 15 },
          { title: "Knowledge check", type: "QUIZ", minutes: 8 },
        ],
      },
    ],
    quiz: [
      {
        type: "SINGLE_CHOICE",
        text: "How many standards make up the Care Certificate?",
        correct: [2],
        options: ["Ten", "Twelve", "Fifteen", "Twenty"],
      },
      {
        type: "TRUE_FALSE",
        text: "Confidential information may be shared with anyone who asks.",
        explanation: "Only share information with people who need it to provide care.",
        correct: [1],
        options: ["True", "False"],
      },
      {
        type: "MULTIPLE_CHOICE",
        text: "Which of these help prevent infection?",
        correct: [0, 1],
        options: ["Washing hands properly", "Wearing the right protective equipment", "Sharing personal items", "Skipping cleaning between tasks"],
      },
    ],
  },
  {
    slug: "teaching-assistant-level-1-2-3",
    title: "Teaching Assistant Level 1, 2 & 3 + Early Years, SEN, Primary Teaching & Child Care",
    image: "photo-1587654780291-39c9404d746b",
    category: "Teaching",
    summary: "6 Courses | CPD Certified | Institute of Hospitality Endorsed",
    shortDescription: "Everything you need to start supporting learners in the classroom.",
    price: 15,
    oldPrice: 299,
    badge: "Great service",
    minutes: 240,
    level: "ALL_LEVELS",
    tags: ["Teaching", "CPD"],
    publishedDaysAgo: 100,
  },
  {
    slug: "health-and-social-care-level-5",
    title: "Level 5 Certificate in Health and Social Care + Care Certificate Standards (1 to 15)",
    image: "photo-1532938911079-1b06ac7ceec7",
    category: "Healthcare",
    summary: "15 CPD Courses Bundle | 1200+ Training Hours",
    shortDescription: "Advance into senior care roles with a leadership-focused qualification.",
    price: 15,
    oldPrice: 199,
    badge: "Great service",
    minutes: 480,
    level: "ADVANCED",
    tags: ["Care", "CPD"],
    publishedDaysAgo: 95,
  },
  {
    slug: "microsoft-excel-complete",
    title: "Microsoft Excel Complete Course - Beginner, Intermediate & Advanced (Updated 2025)",
    image: "photo-1516321318423-f06f85e504b3",
    category: "IT & Computing",
    summary: "5 Courses Bundle + Free PDF Certificate | 300+ Video Training",
    shortDescription: "From your first spreadsheet to pivot tables and dashboards.",
    price: 15,
    oldPrice: 199,
    badge: "Best Seller",
    minutes: 600,
    level: "ALL_LEVELS",
    tags: ["Microsoft Office"],
    publishedDaysAgo: 90,
  },
  {
    slug: "health-and-social-care-level-3",
    title: "Level 3 Diploma in Health and Social Care",
    image: "photo-1576091160399-112ba8d25d1d",
    category: "Health & Social Care",
    price: 21.99,
    minutes: 360,
    level: "INTERMEDIATE",
    featured: true,
    tags: ["Care"],
    publishedDaysAgo: 85,
  },
  {
    slug: "health-and-safety-workplace",
    title: "Health and Safety in the Workplace (High Risk)",
    image: "photo-1504307651254-35680f356dfd",
    category: "Health & Safety",
    summary: "Recognise hazards, assess risk and keep people safe",
    price: 1.99,
    oldPrice: 19.99,
    minutes: 180,
    level: "ALL_LEVELS",
    featured: true,
    tags: ["Health & Safety", "CPD"],
    publishedDaysAgo: 80,
    modules: [
      {
        title: "Hazards and risk",
        lessons: [
          { title: "Why health and safety matters", type: "VIDEO", minutes: 6, preview: true },
          {
            title: "Spotting common hazards",
            type: "TEXT",
            minutes: 8,
            preview: true,
            text: [
              { type: "paragraph", text: "Slips, trips and manual handling injuries account for most workplace accidents. Most can be prevented with simple habits." },
              { type: "list", items: ["Keep walkways clear", "Report spills straight away", "Lift with your legs, not your back", "Use equipment as trained"] },
            ],
          },
          { title: "Risk assessment template", type: "DOCUMENT", minutes: 3 },
        ],
      },
      {
        title: "Working safely",
        lessons: [
          { title: "Personal protective equipment", type: "VIDEO", minutes: 12 },
          { title: "Emergency procedures", type: "VIDEO", minutes: 14 },
          { title: "Reporting accidents", type: "TEXT", minutes: 5, text: [{ type: "paragraph", text: "Every accident and near miss should be written in the accident book. Reporting helps your employer find the cause and stop it happening again." }] },
        ],
      },
      {
        title: "Check your knowledge",
        lessons: [{ title: "Workplace safety quiz", type: "QUIZ", minutes: 8 }],
      },
    ],
    quiz: [
      {
        type: "SINGLE_CHOICE",
        text: "What should you do first if you see a spill on the floor?",
        correct: [1],
        options: ["Walk around it", "Report it or make it safe", "Wait for someone else", "Cover it with a rug"],
      },
      {
        type: "TRUE_FALSE",
        text: "Near misses do not need to be reported.",
        explanation: "Near misses show where an accident could happen, so report them too.",
        correct: [1],
        options: ["True", "False"],
      },
      {
        type: "MULTIPLE_CHOICE",
        text: "Which are common causes of workplace injury?",
        correct: [0, 2],
        options: ["Slips and trips", "Drinking water", "Manual handling", "Taking breaks"],
      },
    ],
  },
  {
    slug: "childcare-early-years-level-2",
    title: "Level 2 Certificate in Childcare and Early Years",
    image: "photo-1587654780291-39c9404d746b",
    category: "Teaching",
    price: 21.99,
    minutes: 300,
    level: "BEGINNER",
    featured: true,
    tags: ["Teaching"],
    publishedDaysAgo: 75,
  },
  {
    slug: "microsoft-office-365",
    title: "Microsoft Office 365 (Word, Excel, PowerPoint)",
    image: "photo-1516321318423-f06f85e504b3",
    category: "IT & Computing",
    price: 19.99,
    minutes: 240,
    level: "BEGINNER",
    featured: true,
    tags: ["Microsoft Office"],
    publishedDaysAgo: 70,
  },
  {
    slug: "medical-administration",
    title: "Medical Administration and Reception Skills",
    image: "photo-1532938911079-1b06ac7ceec7",
    category: "Healthcare",
    price: 4.4,
    oldPrice: 21.99,
    minutes: 270,
    level: "BEGINNER",
    featured: true,
    tags: ["Care"],
    publishedDaysAgo: 65,
  },
  {
    slug: "leadership-management-level-5",
    title: "Level 5 Diploma in Leadership and Management",
    image: "photo-1556761175-5973dc0f32e7",
    category: "Business",
    price: 5,
    oldPrice: 24.99,
    minutes: 420,
    level: "ADVANCED",
    featured: true,
    tags: ["Management"],
    publishedDaysAgo: 60,
  },
  {
    slug: "construction-health-safety",
    title: "Construction Health & Safety (SSSTS)",
    image: "photo-1541888946425-d81bb19240f5",
    category: "Construction",
    price: 4,
    oldPrice: 19.99,
    minutes: 240,
    level: "INTERMEDIATE",
    featured: true,
    tags: ["Health & Safety"],
    publishedDaysAgo: 55,
  },
  {
    slug: "business-administration-level-3",
    title: "Level 3 Diploma in Business Administration",
    image: "photo-1454165804606-c3d57bc86b40",
    category: "Business",
    price: 21.99,
    minutes: 360,
    level: "INTERMEDIATE",
    featured: true,
    tags: ["Management"],
    publishedDaysAgo: 50,
  },
  {
    slug: "hr-audit",
    title: "Human Resources (HR) Audit",
    image: "photo-1551836022-d5d88e9218df",
    category: "Business",
    price: 4.4,
    oldPrice: 21.99,
    minutes: 150,
    level: "INTERMEDIATE",
    tags: ["Management"],
    publishedDaysAgo: 45,
  },
  {
    slug: "barista-training",
    title: "Barista Training",
    image: "photo-1513558161293-cdaf765ed2fd",
    category: "Hospitality",
    price: 19.99,
    minutes: 120,
    level: "BEGINNER",
    publishedDaysAgo: 40,
  },
  {
    slug: "functional-skills-it",
    title: "Functional Skills IT",
    image: "photo-1516321318423-f06f85e504b3",
    category: "IT & Computing",
    summary: "Free course | Everyday digital skills",
    shortDescription: "Learn to use a computer, find information online and stay safe on the internet.",
    price: 0,
    oldPrice: 14.99,
    minutes: 120,
    level: "BEGINNER",
    tags: ["Free"],
    publishedDaysAgo: 35,
    modules: [
      {
        title: "Using a computer",
        lessons: [
          { title: "Welcome", type: "VIDEO", minutes: 3, preview: true },
          {
            title: "Parts of a computer",
            type: "TEXT",
            minutes: 6,
            preview: true,
            text: [
              { type: "paragraph", text: "A computer is made of hardware you can touch, such as the screen and keyboard, and software that tells it what to do." },
              { type: "list", items: ["Monitor", "Keyboard and mouse", "System unit", "Operating system"] },
            ],
          },
          { title: "Keyboard shortcuts", type: "DOCUMENT", minutes: 2 },
        ],
      },
      {
        title: "Staying safe online",
        lessons: [
          { title: "Strong passwords", type: "VIDEO", minutes: 8 },
          { title: "Spotting scam emails", type: "TEXT", minutes: 6, text: [{ type: "paragraph", text: "Scam emails often create urgency, ask for personal details or contain links that do not match the sender. If in doubt, do not click." }] },
        ],
      },
    ],
  },
  {
    slug: "business-information-communication",
    title: "Business Information & Communication",
    image: "photo-1521737711867-e3b97375f902",
    category: "Business",
    price: 0,
    oldPrice: 19.99,
    minutes: 90,
    level: "BEGINNER",
    tags: ["Free"],
    publishedDaysAgo: 30,
  },
  {
    slug: "basic-english-for-business",
    title: "Basic English for Business",
    image: "photo-1544717297-fa95b6ee9643",
    category: "Language",
    price: 0,
    oldPrice: 14.99,
    minutes: 90,
    level: "BEGINNER",
    tags: ["Free"],
    publishedDaysAgo: 25,
  },
  {
    slug: "job-search-skills",
    title: "Job Search Skills",
    image: "photo-1486312338219-ce68d2c6f44d",
    category: "Career",
    price: 0,
    oldPrice: 16.99,
    minutes: 90,
    level: "ALL_LEVELS",
    tags: ["Free"],
    publishedDaysAgo: 20,
  },
];

// Modules for courses that have none of their own, so every course page shows a
// curriculum. Built from the course title.
export function genericModules(title: string): SampleModule[] {
  return [
    {
      title: "Getting started",
      lessons: [
        { title: "Welcome to the course", type: "VIDEO", minutes: 4, preview: true },
        {
          title: "What you will learn",
          type: "TEXT",
          minutes: 5,
          preview: true,
          text: [
            { type: "paragraph", text: `Welcome to ${title}. This course takes you through the essentials step by step, with short lessons you can finish in your own time.` },
            { type: "list", items: ["Clear learning outcomes for every module", "Practical examples", "A recap at the end"] },
          ],
        },
        { title: "Course handbook", type: "DOCUMENT", minutes: 3 },
      ],
    },
    {
      title: "Core knowledge",
      lessons: [
        { title: "Key concepts explained", type: "VIDEO", minutes: 15 },
        { title: "Worked examples", type: "VIDEO", minutes: 12 },
        { title: "Practice exercise", type: "DOCUMENT", minutes: 10 },
      ],
    },
    {
      title: "Wrapping up",
      lessons: [
        { title: "Recap and next steps", type: "TEXT", minutes: 5, text: [{ type: "paragraph", text: "Well done for reaching the end. Review your notes, revisit any lesson you would like to practise again, and think about how you will use what you have learned." }] },
      ],
    },
  ];
}
