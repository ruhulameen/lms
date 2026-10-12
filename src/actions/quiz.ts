"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { formValues, type FormState } from "@/lib/form-state";
import { canonicalOptions, moveId, questionInputSchema, quizSettingsSchema, type QuestionInput } from "@/lib/quiz";
import { refreshCourses } from "@/lib/revalidate-courses";
import { logActivity } from "@/services/activity";
import { authorizeCourseAction } from "@/services/course-access";
import { recalculateCourseProgress } from "@/services/learning";
import { ensureQuiz } from "@/services/quiz";

// Quiz builder actions: settings, questions and their order. Each re-checks
// the course (course.edit and ownership) and that the lesson is a quiz lesson
// of that course. Learners' old attempts keep their own copy of the questions,
// so editing or deleting a question never changes them.

const NOT_FOUND = "This quiz no longer exists.";
const idSchema = z.coerce.number().int().positive();

async function quizLesson(courseId: number, lessonId: number) {
  return db.lesson.findFirst({
    where: { id: lessonId, courseId, type: "QUIZ" },
    select: { id: true, title: true, published: true, course: { select: { title: true } } },
  });
}

function invalid(error: z.ZodError, formData: FormData): FormState {
  return {
    ok: false,
    error: "Fix the highlighted fields and try again.",
    fieldErrors: z.flattenError(error).fieldErrors,
    values: formValues(formData),
  };
}

export async function saveQuizSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const courseId = idSchema.safeParse(formData.get("courseId"));
  const lessonId = idSchema.safeParse(formData.get("lessonId"));
  if (!courseId.success || !lessonId.success) return { ok: false, error: NOT_FOUND, values: formValues(formData) };
  const authz = await authorizeCourseAction(courseId.data, "course.edit");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };
  const parsed = quizSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const lesson = await quizLesson(courseId.data, lessonId.data);
  if (!lesson) return { ok: false, error: NOT_FOUND, values: formValues(formData) };

  const quizId = await ensureQuiz(lesson.id);
  await db.quiz.update({ where: { id: quizId }, data: parsed.data });
  await logActivity({
    userId: authz.user.id,
    action: "quiz.update",
    entity: "quiz",
    entityId: quizId,
    details: { quiz: lesson.title, course: lesson.course.title, passingScore: parsed.data.passingScore },
  });
  refreshCourses();
  return { ok: true, message: "Quiz settings saved." };
}

const questionSchema = z.object({
  courseId: z.number().int().positive(),
  lessonId: z.number().int().positive(),
  // Absent when adding a question.
  questionId: z.number().int().positive().optional(),
  question: questionInputSchema,
});

export async function saveQuestion(input: {
  courseId: number;
  lessonId: number;
  questionId?: number;
  question: QuestionInput;
}): Promise<ActionResult> {
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Check the question and try again." };
  }
  const { courseId, lessonId, questionId, question } = parsed.data;
  const authz = await authorizeCourseAction(courseId, "course.edit");
  if (!authz.ok) return authz.result;
  const lesson = await quizLesson(courseId, lessonId);
  if (!lesson) return { ok: false, error: NOT_FOUND };
  const quizId = await ensureQuiz(lesson.id);

  const data = {
    type: question.type,
    text: question.text,
    explanation: question.explanation,
    points: question.points,
    options: canonicalOptions(question.type, question.options),
  };
  if (questionId) {
    const existing = await db.question.findFirst({ where: { id: questionId, quizId }, select: { id: true } });
    if (!existing) return { ok: false, error: "This question no longer exists." };
    await db.question.update({ where: { id: questionId }, data });
  } else {
    const last = await db.question.aggregate({ where: { quizId }, _max: { position: true } });
    const created = await db.question.create({ data: { quizId, ...data, position: (last._max.position ?? -1) + 1 }, select: { id: true } });
    await logActivity({
      userId: authz.user.id,
      action: "quiz-question.create",
      entity: "quiz-question",
      entityId: created.id,
      details: { question: question.text, quiz: lesson.title, course: lesson.course.title },
    });
    refreshCourses();
    return { ok: true, message: "Question added." };
  }
  await logActivity({
    userId: authz.user.id,
    action: "quiz-question.update",
    entity: "quiz-question",
    entityId: questionId,
    details: { question: question.text, quiz: lesson.title, course: lesson.course.title },
  });
  refreshCourses();
  return { ok: true, message: "Question saved." };
}

export async function deleteQuestion(formData: FormData): Promise<ActionResult> {
  const courseId = idSchema.safeParse(formData.get("courseId"));
  const lessonId = idSchema.safeParse(formData.get("lessonId"));
  const questionId = idSchema.safeParse(formData.get("questionId"));
  if (!courseId.success || !lessonId.success || !questionId.success) return { ok: false, error: NOT_FOUND };
  const authz = await authorizeCourseAction(courseId.data, "course.edit");
  if (!authz.ok) return authz.result;
  const lesson = await quizLesson(courseId.data, lessonId.data);
  if (!lesson) return { ok: false, error: NOT_FOUND };
  const quizId = await ensureQuiz(lesson.id);
  const question = await db.question.findFirst({ where: { id: questionId.data, quizId }, select: { id: true, text: true } });
  if (!question) return { ok: false, error: "This question no longer exists." };

  const remaining = await db.$transaction(async (tx) => {
    await tx.question.delete({ where: { id: question.id } });
    const rest = await tx.question.findMany({ where: { quizId }, orderBy: [{ position: "asc" }, { id: "asc" }], select: { id: true, position: true } });
    for (const [index, q] of rest.entries()) {
      if (q.position !== index) await tx.question.update({ where: { id: q.id }, data: { position: index } });
    }
    return rest.length;
  });
  await logActivity({
    userId: authz.user.id,
    action: "quiz-question.delete",
    entity: "quiz-question",
    entityId: question.id,
    details: { question: question.text, quiz: lesson.title, course: lesson.course.title },
  });
  // A quiz with no questions cannot be taken: hide the lesson again.
  let message = "Question deleted.";
  if (remaining === 0 && lesson.published) {
    await db.lesson.update({ where: { id: lesson.id }, data: { published: false } });
    await recalculateCourseProgress(courseId.data);
    message = "Question deleted. The quiz has no questions left, so the lesson is hidden until you add one.";
  }
  refreshCourses();
  return { ok: true, message };
}

const moveSchema = z.object({
  courseId: z.number().int().positive(),
  lessonId: z.number().int().positive(),
  questionId: z.number().int().positive(),
  direction: z.union([z.literal(-1), z.literal(1)]),
});

export async function moveQuestion(input: z.input<typeof moveSchema>): Promise<ActionResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { courseId, lessonId, questionId, direction } = parsed.data;
  const authz = await authorizeCourseAction(courseId, "course.edit");
  if (!authz.ok) return authz.result;
  const lesson = await quizLesson(courseId, lessonId);
  if (!lesson) return { ok: false, error: NOT_FOUND };
  const quizId = await ensureQuiz(lesson.id);

  const rows = await db.question.findMany({ where: { quizId }, orderBy: [{ position: "asc" }, { id: "asc" }], select: { id: true, position: true } });
  if (!rows.some((r) => r.id === questionId)) return { ok: false, error: "This question no longer exists." };
  const order = moveId(rows.map((r) => r.id), questionId, direction);
  const position = new Map(rows.map((r) => [r.id, r.position]));
  await db.$transaction(async (tx) => {
    for (const [index, id] of order.entries()) {
      if (position.get(id) !== index) await tx.question.update({ where: { id }, data: { position: index } });
    }
  });
  await logActivity({
    userId: authz.user.id,
    action: "quiz-question.reorder",
    entity: "quiz",
    entityId: quizId,
    details: { quiz: lesson.title, course: lesson.course.title },
  });
  refreshCourses();
  return { ok: true };
}
