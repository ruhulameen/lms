import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ContentStatusValue } from "@/lib/content-status";
import { courseImageSrc, lessonNeedsFile, type LessonTypeValue } from "@/lib/course";
import { publicUrl } from "@/lib/storage";
import { getMediaSummary } from "@/services/media";
import { getSeo } from "@/services/seo";

// Admin-side course reads (editor and lists). Call them only after the page has
// checked the permission and, for one course, assertCourseAccess().

export const COURSE_ADMIN_PAGE_SIZE = 15;

export const COURSE_SORT_KEYS = ["title", "status", "category", "instructor", "price", "date", "updated"] as const;
export type CourseSortKey = (typeof COURSE_SORT_KEYS)[number];

export type CourseListFilters = {
  search?: string;
  status?: ContentStatusValue;
  categoryId?: number;
  instructorId?: number;
  // Limit to courses the user may manage: pass manageableCoursesWhere(user).
  scope?: Prisma.CourseWhereInput;
  sort: CourseSortKey;
  order: "asc" | "desc";
  page: number;
};

export async function listCourses(filters: CourseListFilters) {
  const search = filters.search?.trim();
  const where: Prisma.CourseWhereInput = {
    AND: [
      filters.scope ?? {},
      {
        status: filters.status,
        categoryId: filters.categoryId,
        instructorId: filters.instructorId,
        OR: search ? [{ title: { contains: search } }, { slug: { contains: search } }] : undefined,
      },
    ],
  };
  const dir = filters.order;
  const orderBy: Prisma.CourseOrderByWithRelationInput[] = [
    filters.sort === "category"
      ? { category: { name: dir } }
      : filters.sort === "instructor"
        ? { instructor: { name: dir } }
        : filters.sort === "date"
          ? { publishedAt: dir }
          : filters.sort === "updated"
            ? { updatedAt: dir }
            : { [filters.sort]: dir },
    { id: "desc" },
  ];
  const [rows, total] = await Promise.all([
    db.course.findMany({
      where,
      orderBy,
      skip: (filters.page - 1) * COURSE_ADMIN_PAGE_SIZE,
      take: COURSE_ADMIN_PAGE_SIZE,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        price: true,
        featured: true,
        publishedAt: true,
        publishAt: true,
        updatedAt: true,
        externalImageId: true,
        instructorId: true,
        createdById: true,
        thumbnail: { select: { key: true } },
        category: { select: { name: true } },
        instructor: { select: { id: true, name: true } },
        _count: { select: { modules: true, lessons: true, enrolments: true } },
      },
    }),
    db.course.count({ where }),
  ]);
  return {
    rows: rows.map(({ thumbnail, externalImageId, ...r }) => ({
      ...r,
      price: Number(r.price),
      imageSrc: courseImageSrc({ imageUrl: thumbnail ? publicUrl(thumbnail.key) : null, externalImageId }, 96),
    })),
    total,
    page: filters.page,
    pageSize: COURSE_ADMIN_PAGE_SIZE,
  };
}

// The course with every module and lesson in order (published or not), for the
// editor and the curriculum builder. Prices are plain numbers, file sizes plain
// numbers; storage keys are included for the server only: never pass `fileKey`
// to a client component.
export async function getCourseForEdit(id: number) {
  const course = await db.course.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      subtitle: true,
      shortDescription: true,
      description: true,
      thumbnailId: true,
      externalImageId: true,
      introVideoKey: true,
      introVideoName: true,
      introVideoMime: true,
      introVideoSize: true,
      price: true,
      compareAtPrice: true,
      level: true,
      language: true,
      durationMinutes: true,
      badge: true,
      featured: true,
      instructorId: true,
      createdById: true,
      categoryId: true,
      status: true,
      publishAt: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      tags: { select: { tagId: true } },
      modules: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          position: true,
          lessons: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              moduleId: true,
              title: true,
              slug: true,
              type: true,
              content: true,
              fileKey: true,
              fileName: true,
              fileMimeType: true,
              fileSize: true,
              durationSeconds: true,
              position: true,
              isFreePreview: true,
              published: true,
              resources: {
                orderBy: { position: "asc" },
                select: { id: true, title: true, fileKey: true, fileName: true, fileMimeType: true, fileSize: true, position: true },
              },
              quiz: { select: { id: true, _count: { select: { questions: true } } } },
            },
          },
        },
      },
    },
  });
  if (!course) return null;
  const seo = await getSeo("COURSE", id);
  const [thumbnail, socialImage] = await Promise.all([
    getMediaSummary(course.thumbnailId),
    getMediaSummary(seo?.socialImageId),
  ]);
  return {
    ...course,
    price: Number(course.price),
    compareAtPrice: course.compareAtPrice === null ? null : Number(course.compareAtPrice),
    introVideoSize: course.introVideoSize === null ? null : Number(course.introVideoSize),
    tagIds: course.tags.map((t) => t.tagId),
    modules: course.modules.map((m) => ({
      ...m,
      lessons: m.lessons.map((l) => ({
        ...l,
        fileSize: l.fileSize === null ? null : Number(l.fileSize),
        resources: l.resources.map((r) => ({ ...r, fileSize: Number(r.fileSize) })),
      })),
    })),
    seo,
    thumbnail,
    socialImage,
  };
}

export async function getCourseHeading(id: number) {
  return db.course.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true, status: true, instructorId: true, createdById: true },
  });
}

export async function listCourseCategoryOptions() {
  return db.courseCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}

export async function listCourseTagOptions() {
  return db.courseTag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

// Users who may teach: admins and anyone whose role can create or edit courses.
// `include` keeps a course's current instructor listed even if their role changed.
export async function listInstructorOptions(include?: number | null) {
  return db.user.findMany({
    where: {
      OR: [
        {
          status: "ACTIVE",
          role: {
            OR: [
              { name: { in: ["admin", "instructor"] } },
              { permissions: { some: { permission: { key: { in: ["course.create", "course.edit", "course.publish"] } } } } },
            ],
          },
        },
        ...(include ? [{ id: include }] : []),
      ],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

// What the curriculum builder (a client component) receives: the structure and
// what to show per lesson, never a storage key.
export type CurriculumLessonView = {
  id: number;
  moduleId: number;
  title: string;
  type: LessonTypeValue;
  durationSeconds: number | null;
  isFreePreview: boolean;
  published: boolean;
  // Video, document and SCORM lessons: whether the file is attached. Text and quiz: null.
  hasFile: boolean | null;
  resourceCount: number;
  questionCount: number | null;
};
export type CurriculumModuleView = {
  id: number;
  title: string;
  description: string | null;
  lessons: CurriculumLessonView[];
};

export function toCurriculumView(course: NonNullable<Awaited<ReturnType<typeof getCourseForEdit>>>): CurriculumModuleView[] {
  return course.modules.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      moduleId: l.moduleId,
      title: l.title,
      type: l.type,
      durationSeconds: l.durationSeconds,
      isFreePreview: l.isFreePreview,
      published: l.published,
      hasFile: lessonNeedsFile(l.type) ? Boolean(l.fileKey) : null,
      resourceCount: l.resources.length,
      questionCount: l.quiz ? l.quiz._count.questions : null,
    })),
  }));
}

// One lesson with its resources, for the lesson editor. Storage keys are for
// the server only: the page must not pass `fileKey` to a client component.
export async function getLessonForEdit(courseId: number, lessonId: number) {
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, courseId },
    select: {
      id: true,
      courseId: true,
      moduleId: true,
      module: { select: { title: true } },
      title: true,
      slug: true,
      type: true,
      content: true,
      fileName: true,
      fileMimeType: true,
      fileSize: true,
      durationSeconds: true,
      scormEntry: true,
      isFreePreview: true,
      published: true,
      updatedAt: true,
      resources: {
        orderBy: { position: "asc" },
        select: { id: true, title: true, fileName: true, fileMimeType: true, fileSize: true },
      },
      quiz: { select: { id: true, passingScore: true, _count: { select: { questions: true } } } },
    },
  });
  if (!lesson) return null;
  return {
    ...lesson,
    fileSize: lesson.fileSize === null ? null : Number(lesson.fileSize),
    resources: lesson.resources.map((r) => ({ ...r, fileSize: Number(r.fileSize) })),
  };
}

// Neighbouring lessons for the editor's previous/next links.
export async function getLessonNeighbours(courseId: number, lessonId: number) {
  const lessons = await db.lesson.findMany({
    where: { courseId },
    orderBy: [{ module: { position: "asc" } }, { position: "asc" }],
    select: { id: true, title: true },
  });
  const index = lessons.findIndex((l) => l.id === lessonId);
  return {
    previous: index > 0 ? lessons[index - 1] : null,
    next: index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null,
  };
}

// Names the preview shows next to the course (instructor with bio, category, tags).
export async function getCoursePreviewExtras(id: number) {
  const row = await db.course.findUnique({
    where: { id },
    select: {
      instructor: { select: { name: true, image: true, bio: true } },
      category: { select: { name: true } },
      tags: { select: { tag: { select: { name: true } } } },
      thumbnail: { select: { key: true } },
      externalImageId: true,
    },
  });
  if (!row) return null;
  return {
    instructor: row.instructor,
    category: row.category?.name ?? null,
    tags: row.tags.map((t) => t.tag.name),
    imageSrc: courseImageSrc({ imageUrl: row.thumbnail ? publicUrl(row.thumbnail.key) : null, externalImageId: row.externalImageId }, 600),
  };
}
