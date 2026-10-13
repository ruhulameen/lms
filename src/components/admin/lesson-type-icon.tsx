import { FileText, HelpCircle, Package, PlayCircle, Type, type LucideIcon } from "lucide-react";
import type { LessonTypeValue } from "@/lib/course";

export const lessonTypeIcons: Record<LessonTypeValue, LucideIcon> = {
  VIDEO: PlayCircle,
  TEXT: Type,
  DOCUMENT: FileText,
  QUIZ: HelpCircle,
  SCORM: Package,
};
