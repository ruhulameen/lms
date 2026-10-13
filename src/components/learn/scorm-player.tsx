"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Maximize2 } from "lucide-react";
import { saveScormLessonProgress } from "@/actions/learning";
import { formatScormTime, scormStatuses, type ScormProgress, type ScormStatus } from "@/lib/scorm";

type ScormPlayerProps = {
  lessonId: number;
  title: string;
  // Start page of the package on this site (/scorm/<lessonId>/...).
  src: string;
  // Where the learner left off, read back by the package to resume.
  initial: ScormProgress;
  learner: { id: number; name: string };
  masteryScore: number | null;
  launchData: string;
  // False for staff and free previews: the package runs, nothing is saved.
  track: boolean;
};

// How long after the package's last change a save is sent.
const SAVE_DELAY_MS = 2000;

type Api = {
  LMSInitialize(arg: string): string;
  LMSFinish(arg: string): string;
  LMSGetValue(element: string): string;
  LMSSetValue(element: string, value: string): string;
  LMSCommit(arg: string): string;
  LMSGetLastError(): string;
  LMSGetErrorString(code: string): string;
  LMSGetDiagnostic(code: string): string;
};

// Plays a SCORM 1.2 package. The package runs in a frame and looks in the page
// around it for an object called `API`; this component puts one there. It
// answers the package's questions from memory (the calls are synchronous, so
// nothing can wait on the server) and sends what the package records to the
// server shortly after each change, and at once when it commits or finishes.
export function ScormPlayer({ lessonId, title, src, initial, learner, masteryScore, launchData, track }: ScormPlayerProps) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Read once: a refresh of the page around the player must not restart the package.
  const start = useRef({ initial, learner, masteryScore, launchData });

  useEffect(() => {
    const { initial, learner, masteryScore, launchData } = start.current;
    // SCORM writes names as "Last, First".
    const names = learner.name.trim().split(/\s+/);
    const studentName = names.length > 1 ? `${names[names.length - 1]}, ${names.slice(0, -1).join(" ")}` : learner.name;
    const resumed = Boolean(initial.suspendData || initial.lessonLocation);

    // The package's data model, as the strings it reads and writes.
    const cmi: Record<string, string> = {
      "cmi.core._children": "student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time",
      "cmi.core.student_id": String(learner.id),
      "cmi.core.student_name": studentName,
      "cmi.core.lesson_location": initial.lessonLocation,
      "cmi.core.credit": "credit",
      "cmi.core.lesson_status": initial.lessonStatus,
      "cmi.core.entry": resumed ? "resume" : "ab-initio",
      "cmi.core.score._children": "raw,min,max",
      "cmi.core.score.raw": initial.scoreRaw === null ? "" : String(initial.scoreRaw),
      "cmi.core.score.min": initial.scoreMin === null ? "" : String(initial.scoreMin),
      "cmi.core.score.max": initial.scoreMax === null ? "" : String(initial.scoreMax),
      "cmi.core.total_time": formatScormTime(initial.totalTimeSeconds),
      "cmi.core.lesson_mode": "normal",
      "cmi.core.exit": "",
      "cmi.core.session_time": "0000:00:00",
      "cmi.suspend_data": initial.suspendData,
      "cmi.launch_data": launchData,
      "cmi.comments": "",
      "cmi.student_data._children": "mastery_score,max_time_allowed,time_limit_action",
      "cmi.student_data.mastery_score": masteryScore === null ? "" : String(masteryScore),
      "cmi.student_data.max_time_allowed": "",
      "cmi.student_data.time_limit_action": "",
    };

    let dirty = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastSaveAt = Date.now();
    let reportedDone = false;
    let saving: Promise<void> = Promise.resolve();

    const score = (key: string) => {
      const value = Number(cmi[key]);
      return cmi[key] !== "" && Number.isFinite(value) ? value : null;
    };

    function save() {
      clearTimeout(timer);
      if (!track || !dirty) return;
      dirty = false;
      const now = Date.now();
      const progress = {
        lessonStatus: (scormStatuses.find((s) => s === cmi["cmi.core.lesson_status"]) ?? "incomplete") as ScormStatus,
        lessonLocation: cmi["cmi.core.lesson_location"],
        scoreRaw: score("cmi.core.score.raw"),
        scoreMin: score("cmi.core.score.min"),
        scoreMax: score("cmi.core.score.max"),
        suspendData: cmi["cmi.suspend_data"],
        // Wall-clock time since the last save, which is more reliable than the
        // session time packages report (many only send it on exit, if at all).
        sessionSeconds: Math.round((now - lastSaveAt) / 1000),
      };
      lastSaveAt = now;
      // One after another, so an older save can never land after a newer one.
      saving = saving
        .then(() => saveScormLessonProgress({ lessonId, progress }))
        .then((result) => {
          if (!result.ok) {
            dirty = true;
            setNotice(`Your progress could not be saved: ${result.error}`);
            return;
          }
          setNotice(null);
          // Tick the lesson in the sidebar and move the progress bar, once.
          if (result.data.lessonCompleted && !reportedDone) {
            reportedDone = true;
            router.refresh();
          }
        })
        .catch(() => {
          dirty = true;
          setNotice("Your progress could not be saved. Check your connection; it will be tried again.");
        });
    }

    const api: Api = {
      LMSInitialize: () => "true",
      LMSFinish: () => {
        dirty = true;
        save();
        return "true";
      },
      LMSGetValue: (element) => cmi[element] ?? "",
      LMSSetValue: (element, value) => {
        // Read-only values a package has no business changing.
        if (/^cmi\.core\.(student_id|student_name|credit|entry|total_time|lesson_mode)$/.test(element) || element.endsWith("._children")) return "false";
        cmi[element] = String(value);
        dirty = true;
        clearTimeout(timer);
        timer = setTimeout(save, SAVE_DELAY_MS);
        return "true";
      },
      LMSCommit: () => {
        save();
        return "true";
      },
      LMSGetLastError: () => "0",
      LMSGetErrorString: () => "No error",
      LMSGetDiagnostic: () => "",
    };

    const host = window as unknown as { API?: Api };
    host.API = api;
    // Only now may the package load: it looks for the API as soon as it starts.
    const element = frame.current;
    if (element) element.src = src;

    // Leaving the page: send whatever is unsaved. Best effort, the browser may cut it short.
    const leave = () => save();
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      save();
      if (host.API === api) delete host.API;
      if (element) element.removeAttribute("src");
    };
  }, [lessonId, router, src, track]);

  return (
    <div className="space-y-3">
      {notice && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          {notice}
        </p>
      )}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {/* The address is set by the effect above, once the API is in place. */}
        <iframe ref={frame} title={title} allow="fullscreen; autoplay" allowFullScreen className="block h-[80vh] min-h-[32rem] w-full" />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => frame.current?.requestFullscreen?.().catch(() => {})}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-navy outline-none hover:bg-gray-50 focus-visible:ring-3 focus-visible:ring-blue-600/40"
        >
          <Maximize2 className="size-3.5" aria-hidden /> Full screen
        </button>
      </div>
    </div>
  );
}
