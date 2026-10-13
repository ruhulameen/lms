"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteLesson, deleteModule, reorderCurriculum } from "@/actions/course-curriculum";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { LessonDialog, ModuleDialog } from "@/components/admin/curriculum-dialogs";
import { lessonTypeIcons } from "@/components/admin/lesson-type-icon";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatLessonDuration, lessonTypeLabels } from "@/lib/course";
import type { CurriculumLessonView, CurriculumModuleView } from "@/services/course-admin";
import { cn } from "@/lib/utils";

type CurriculumBuilderProps = {
  courseId: number;
  // Panel path of the courses area, e.g. "/admin/courses": lesson links are built from it.
  basePath: string;
  modules: CurriculumModuleView[];
  canEdit: boolean;
  // Rendered inside each quiz lesson row (the quiz builder arrives in a later stage).
  renderLessonExtra?: (lesson: CurriculumLessonView) => React.ReactNode;
};

const moduleKey = (id: number) => `m:${id}`;
const lessonKey = (id: number) => `l:${id}`;
const containerKey = (id: number) => `c:${id}`;
const numeric = (key: string | number) => Number(String(key).slice(2));

function toOrder(courseId: number, modules: CurriculumModuleView[]) {
  return { courseId, modules: modules.map((m) => ({ id: m.id, lessonIds: m.lessons.map((l) => l.id) })) };
}

function sameOrder(a: CurriculumModuleView[], b: CurriculumModuleView[]) {
  return JSON.stringify(a.map((m) => [m.id, m.lessons.map((l) => l.id)])) === JSON.stringify(b.map((m) => [m.id, m.lessons.map((l) => l.id)]));
}

// Drag handles and move buttons both end in setModules() + persist(): the new
// order shows at once and is saved in the background; a failed save puts the
// last saved order back.
export function CurriculumBuilder({ courseId, basePath, modules: initial, canEdit, renderLessonExtra }: CurriculumBuilderProps) {
  const [modules, setModules] = useState(initial);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // The order before a drag started, restored when the drag is cancelled.
  const dragStart = useRef<CurriculumModuleView[] | null>(null);
  const confirmed = useRef(initial);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const failedAt = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Modules are only compared with modules, lessons with lessons and module bodies.
  const collisionDetection: CollisionDetection = (args) => {
    const modulesOnly = String(args.active.id).startsWith("m:");
    const containers = args.droppableContainers.filter((c) => String(c.id).startsWith(modulesOnly ? "m:" : "l:") || (!modulesOnly && String(c.id).startsWith("c:")));
    const scoped = { ...args, droppableContainers: containers };
    const hits = pointerWithin(scoped);
    return hits.length > 0 ? hits : closestCenter(scoped);
  };

  function persist(next: CurriculumModuleView[]) {
    const ticket = ++failedAt.current;
    queue.current = queue.current.then(async () => {
      // A later save supersedes an earlier failed one.
      const result = await reorderCurriculum(toOrder(courseId, next)).catch(() => ({ ok: false as const, error: "Could not save the new order." }));
      if (result.ok) {
        confirmed.current = next;
      } else {
        toast.error(result.error);
        if (ticket === failedAt.current) setModules(confirmed.current);
      }
    });
  }

  function commit(next: CurriculumModuleView[], message?: string) {
    setModules(next);
    if (message) setAnnouncement(message);
    persist(next);
  }

  const lessonLocation = (list: CurriculumModuleView[], lessonId: number) => {
    for (const [mi, m] of list.entries()) {
      const li = m.lessons.findIndex((l) => l.id === lessonId);
      if (li >= 0) return { mi, li };
    }
    return null;
  };

  function moveModule(index: number, delta: -1 | 1) {
    const to = index + delta;
    if (to < 0 || to >= modules.length) return;
    commit(arrayMove(modules, index, to), `Module "${modules[index].title}" moved to position ${to + 1} of ${modules.length}.`);
  }

  function moveLesson(lessonId: number, delta: -1 | 1) {
    const loc = lessonLocation(modules, lessonId);
    if (!loc) return;
    const lessons = modules[loc.mi].lessons;
    const to = loc.li + delta;
    if (to < 0 || to >= lessons.length) return;
    const next = modules.map((m, i) => (i === loc.mi ? { ...m, lessons: arrayMove(m.lessons, loc.li, to) } : m));
    commit(next, `Lesson "${lessons[loc.li].title}" moved to position ${to + 1} of ${lessons.length}.`);
  }

  function moveLessonToModule(lessonId: number, moduleId: number) {
    const loc = lessonLocation(modules, lessonId);
    if (!loc || modules[loc.mi].id === moduleId) return;
    const lesson = modules[loc.mi].lessons[loc.li];
    const target = modules.find((m) => m.id === moduleId);
    if (!target) return;
    const next = modules.map((m) => {
      if (m.id === modules[loc.mi].id) return { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) };
      if (m.id === moduleId) return { ...m, lessons: [...m.lessons, { ...lesson, moduleId }] };
      return m;
    });
    commit(next, `Lesson "${lesson.title}" moved to module "${target.title}".`);
  }

  function onDragStart(event: DragStartEvent) {
    setActiveKey(String(event.active.id));
    dragStart.current = modules;
  }

  // Moving a lesson over another module's lessons (or its empty body) hands it over live.
  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !String(active.id).startsWith("l:")) return;
    const overKey = String(over.id);
    if (overKey.startsWith("m:")) return;
    const activeId = numeric(active.id);
    const from = lessonLocation(modules, activeId);
    if (!from) return;
    const toModuleIndex = overKey.startsWith("c:")
      ? modules.findIndex((m) => m.id === numeric(overKey))
      : (lessonLocation(modules, numeric(overKey))?.mi ?? -1);
    if (toModuleIndex < 0 || toModuleIndex === from.mi) return;

    const lesson = modules[from.mi].lessons[from.li];
    const target = modules[toModuleIndex];
    const overIndex = overKey.startsWith("l:") ? target.lessons.findIndex((l) => l.id === numeric(overKey)) : -1;
    const insertAt = overIndex >= 0 ? overIndex : target.lessons.length;
    setModules(
      modules.map((m, i) => {
        if (i === from.mi) return { ...m, lessons: m.lessons.filter((l) => l.id !== activeId) };
        if (i === toModuleIndex) {
          const lessons = [...m.lessons];
          lessons.splice(insertAt, 0, { ...lesson, moduleId: m.id });
          return { ...m, lessons };
        }
        return m;
      }),
    );
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveKey(null);
    const before = dragStart.current ?? modules;
    dragStart.current = null;
    let next = modules;

    if (over && String(active.id).startsWith("m:") && String(over.id).startsWith("m:")) {
      const from = modules.findIndex((m) => m.id === numeric(active.id));
      const to = modules.findIndex((m) => m.id === numeric(over.id));
      if (from >= 0 && to >= 0 && from !== to) next = arrayMove(modules, from, to);
    } else if (over && String(active.id).startsWith("l:")) {
      const loc = lessonLocation(modules, numeric(active.id));
      const overKey = String(over.id);
      if (loc && overKey.startsWith("l:")) {
        const overLoc = lessonLocation(modules, numeric(overKey));
        if (overLoc && overLoc.mi === loc.mi && overLoc.li !== loc.li) {
          next = modules.map((m, i) => (i === loc.mi ? { ...m, lessons: arrayMove(m.lessons, loc.li, overLoc.li) } : m));
        }
      }
    }
    if (sameOrder(next, before)) {
      setModules(before);
      return;
    }
    commit(next, "Order saved.");
  }

  function onDragCancel() {
    setActiveKey(null);
    if (dragStart.current) setModules(dragStart.current);
    dragStart.current = null;
  }

  const activeModule = activeKey?.startsWith("m:") ? modules.find((m) => m.id === numeric(activeKey)) : undefined;
  const activeLesson = activeKey?.startsWith("l:")
    ? modules.flatMap((m) => m.lessons).find((l) => l.id === numeric(activeKey))
    : undefined;

  return (
    <div className="grid gap-4">
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {canEdit && (
        <p className="text-xs text-slate-500">
          Drag the grip to reorder, or use the arrow buttons. Press Space on a grip to pick it up and the arrow keys to move it.
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <SortableContext items={modules.map((m) => moduleKey(m.id))} strategy={verticalListSortingStrategy}>
          <ol className="grid gap-4">
            {modules.map((module, index) => (
              <ModuleCard
                key={module.id}
                courseId={courseId}
                basePath={basePath}
                module={module}
                index={index}
                count={modules.length}
                allModules={modules}
                canEdit={canEdit}
                onMoveModule={(delta) => moveModule(index, delta)}
                onMoveLesson={moveLesson}
                onMoveLessonToModule={moveLessonToModule}
                renderLessonExtra={renderLessonExtra}
              />
            ))}
          </ol>
        </SortableContext>
        <DragOverlay>
          {activeModule && <div className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold shadow-lg">{activeModule.title}</div>}
          {activeLesson && <LessonRowBody lesson={activeLesson} basePath={basePath} courseId={courseId} overlay />}
        </DragOverlay>
      </DndContext>

      {modules.length === 0 && (
        <p className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-slate-500">
          This course has no modules yet.{canEdit ? " Add one, then add lessons to it." : ""}
        </p>
      )}
      {canEdit && (
        <div>
          <ModuleDialog courseId={courseId} trigger={<><Plus aria-hidden /> Add module</>} triggerVariant="default" />
        </div>
      )}
    </div>
  );
}

type ModuleCardProps = {
  courseId: number;
  basePath: string;
  module: CurriculumModuleView;
  index: number;
  count: number;
  allModules: CurriculumModuleView[];
  canEdit: boolean;
  onMoveModule: (delta: -1 | 1) => void;
  onMoveLesson: (lessonId: number, delta: -1 | 1) => void;
  onMoveLessonToModule: (lessonId: number, moduleId: number) => void;
  renderLessonExtra?: CurriculumBuilderProps["renderLessonExtra"];
};

function ModuleCard({ courseId, basePath, module, index, count, allModules, canEdit, onMoveModule, onMoveLesson, onMoveLessonToModule, renderLessonExtra }: ModuleCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: moduleKey(module.id),
    disabled: !canEdit,
  });
  const { setNodeRef: setBodyRef } = useDroppable({ id: containerKey(module.id) });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("overflow-hidden rounded-xl border bg-white", isDragging && "opacity-40")}
    >
      <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50 px-3 py-2.5">
        {canEdit && (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag module ${module.title}`}
            className="cursor-grab touch-none rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold text-slate-900">
            <span className="text-slate-500">Module {index + 1}</span> · {module.title}
          </h2>
          {module.description && <p className="truncate text-xs text-slate-500">{module.description}</p>}
        </div>
        <span className="text-xs text-slate-500">
          {module.lessons.length} {module.lessons.length === 1 ? "lesson" : "lessons"}
        </span>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-1">
            <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMoveModule(-1)} aria-label={`Move module ${module.title} up`}>
              <ArrowUp aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" disabled={index === count - 1} onClick={() => onMoveModule(1)} aria-label={`Move module ${module.title} down`}>
              <ArrowDown aria-hidden />
            </Button>
            <ModuleDialog courseId={courseId} module={module} trigger={<><Pencil aria-hidden /> Edit</>} triggerLabel={`Edit module ${module.title}`} triggerVariant="ghost" />
            <ConfirmDialog
              action={deleteModule}
              fields={{ courseId: String(courseId), moduleId: String(module.id) }}
              title={`Delete module "${module.title}"?`}
              description={
                module.lessons.length > 0
                  ? `Its ${module.lessons.length} lesson${module.lessons.length === 1 ? "" : "s"}, their files, resources, quizzes and learners' progress on them are deleted for good.`
                  : "The module is empty."
              }
              trigger={<><Trash2 aria-hidden /> Delete</>}
              triggerVariant="ghost"
              triggerLabel={`Delete module ${module.title}`}
              confirmLabel="Delete module"
              destructive
            />
          </div>
        )}
      </div>

      <div ref={setBodyRef} className="min-h-12">
        <SortableContext items={module.lessons.map((l) => lessonKey(l.id))} strategy={verticalListSortingStrategy}>
          <ul>
            {module.lessons.map((lesson, li) => (
              <LessonRow
                key={lesson.id}
                courseId={courseId}
                basePath={basePath}
                lesson={lesson}
                isFirst={li === 0}
                isLast={li === module.lessons.length - 1}
                otherModules={allModules.filter((m) => m.id !== module.id)}
                canEdit={canEdit}
                onMove={(delta) => onMoveLesson(lesson.id, delta)}
                onMoveToModule={(moduleId) => onMoveLessonToModule(lesson.id, moduleId)}
                extra={renderLessonExtra?.(lesson)}
              />
            ))}
          </ul>
        </SortableContext>
        {module.lessons.length === 0 && <p className="px-4 py-3 text-xs text-slate-400">No lessons yet. Drop one here or add one.</p>}
      </div>

      {canEdit && (
        <div className="border-t px-3 py-2">
          <LessonDialog courseId={courseId} moduleId={module.id} trigger={<><Plus aria-hidden /> Add lesson</>} triggerLabel={`Add a lesson to ${module.title}`} triggerVariant="ghost" />
        </div>
      )}
    </li>
  );
}

type LessonRowProps = {
  courseId: number;
  basePath: string;
  lesson: CurriculumLessonView;
  isFirst: boolean;
  isLast: boolean;
  otherModules: CurriculumModuleView[];
  canEdit: boolean;
  onMove: (delta: -1 | 1) => void;
  onMoveToModule: (moduleId: number) => void;
  extra?: React.ReactNode;
};

function LessonRow({ courseId, basePath, lesson, isFirst, isLast, otherModules, canEdit, onMove, onMoveToModule, extra }: LessonRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: lessonKey(lesson.id),
    disabled: !canEdit,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex flex-wrap items-center gap-2 border-b px-3 py-2 last:border-b-0", isDragging && "opacity-40")}
    >
      {canEdit && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Drag lesson ${lesson.title}`}
          className="cursor-grab touch-none rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      )}
      <LessonRowBody lesson={lesson} basePath={basePath} courseId={courseId} />
      {extra}
      {canEdit && (
        <div className="flex items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon-sm" disabled={isFirst} onClick={() => onMove(-1)} aria-label={`Move lesson ${lesson.title} up`}>
            <ArrowUp aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" disabled={isLast} onClick={() => onMove(1)} aria-label={`Move lesson ${lesson.title} down`}>
            <ArrowDown aria-hidden />
          </Button>
          {otherModules.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`Move lesson ${lesson.title} to another module`} />}>
                <MoreHorizontal aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Move to module</DropdownMenuLabel>
                  {otherModules.map((m) => (
                    <DropdownMenuItem key={m.id} onClick={() => onMoveToModule(m.id)}>
                      {m.title}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <ConfirmDialog
            action={deleteLesson}
            fields={{ courseId: String(courseId), lessonId: String(lesson.id) }}
            title={`Delete lesson "${lesson.title}"?`}
            description="The lesson, its file, resources and any learner progress on it are deleted for good."
            trigger={<Trash2 aria-hidden />}
            triggerVariant="ghost"
            triggerLabel={`Delete lesson ${lesson.title}`}
            confirmLabel="Delete lesson"
            destructive
          />
        </div>
      )}
    </li>
  );
}

function LessonRowBody({ lesson, basePath, courseId, overlay }: { lesson: CurriculumLessonView; basePath: string; courseId: number; overlay?: boolean }) {
  const Icon = lessonTypeIcons[lesson.type];
  const length = formatLessonDuration(lesson.durationSeconds);
  return (
    <div className={cn("flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1", overlay && "rounded-lg border bg-white px-3 py-2 shadow-lg")}>
      <Icon className="size-4 shrink-0 text-blue-600" aria-label={lessonTypeLabels[lesson.type]} />
      <Link href={`${basePath}/${courseId}/curriculum/lessons/${lesson.id}`} className="min-w-0 truncate text-sm font-medium text-blue-700 hover:underline">
        {lesson.title}
      </Link>
      {length && <span className="text-xs text-slate-500">{length}</span>}
      {lesson.isFreePreview && <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-800">Free preview</span>}
      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", lesson.published ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700")}>
        {lesson.published ? "Published" : "Hidden"}
      </span>
      {lesson.hasFile === true && <span className="text-[11px] text-slate-500">File attached</span>}
      {lesson.hasFile === false && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">No file yet</span>}
      {lesson.resourceCount > 0 && (
        <span className="text-[11px] text-slate-500">
          {lesson.resourceCount} {lesson.resourceCount === 1 ? "resource" : "resources"}
        </span>
      )}
      {lesson.questionCount !== null && (
        <span className="text-[11px] text-slate-500">
          {lesson.questionCount} {lesson.questionCount === 1 ? "question" : "questions"}
        </span>
      )}
      {lesson.questionCount === 0 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">No questions yet</span>}
      {lesson.questionCount !== null && !overlay && (
        <Link href={`${basePath}/${courseId}/curriculum/lessons/${lesson.id}#quiz-questions`} className="text-[11px] text-blue-700 hover:underline">
          Edit quiz
        </Link>
      )}
    </div>
  );
}
