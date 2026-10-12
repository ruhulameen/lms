"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { refreshVideoLink, saveLessonPosition } from "@/actions/learning";
import { POSITION_SAVE_INTERVAL_SECONDS, VIDEO_COMPLETE_RATIO } from "@/lib/learning";

type VideoPlayerProps = {
  lessonId: number;
  title: string;
  src: string;
  startAt: number;
  durationSeconds: number | null;
  // Save position and progress? False for previews and staff.
  track: boolean;
  completed: boolean;
};

// A plain <video> of the lesson file. While it plays the position is saved
// every POSITION_SAVE_INTERVAL_SECONDS and when the learner pauses or leaves;
// the server completes the lesson once enough has been watched. If the signed
// link expires mid-lesson, a fresh one is fetched and playback carries on.
export function VideoPlayer({ lessonId, title, src, startAt, durationSeconds, track, completed }: VideoPlayerProps) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState(src);
  const [failed, setFailed] = useState(false);
  const seekTo = useRef(startAt);
  const lastSavedAt = useRef(0);
  const completedRef = useRef(completed);
  const retries = useRef(0);

  const save = useCallback(
    async (force = false) => {
      const el = video.current;
      if (!track || !el || el.readyState < 1) return;
      const now = Date.now();
      if (!force && now - lastSavedAt.current < POSITION_SAVE_INTERVAL_SECONDS * 1000) return;
      lastSavedAt.current = now;
      const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : durationSeconds;
      const result = await saveLessonPosition({
        lessonId,
        positionSeconds: el.currentTime,
        durationSeconds: duration,
      });
      if (result.ok && result.data.lessonCompleted && !completedRef.current) {
        completedRef.current = true;
        router.refresh();
      }
    },
    [track, lessonId, durationSeconds, router],
  );

  // Save when the tab is hidden or the learner moves to another lesson.
  useEffect(() => {
    if (!track) return;
    const el = video.current;
    const onHide = () => {
      if (document.visibilityState === "hidden") void save(true);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      if (el && el.currentTime > 0) void save(true);
    };
  }, [track, save]);

  function onTimeUpdate() {
    const el = video.current;
    if (!el) return;
    // Past the completion mark: save now (still at most every few seconds).
    const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : durationSeconds;
    const pastMark = !completedRef.current && Boolean(duration) && el.currentTime >= duration! * VIDEO_COMPLETE_RATIO;
    void save(pastMark && Date.now() - lastSavedAt.current > 3000);
  }

  async function onError() {
    const el = video.current;
    if (!el || retries.current >= 2) {
      setFailed(true);
      return;
    }
    retries.current += 1;
    seekTo.current = el.currentTime;
    const result = await refreshVideoLink(lessonId);
    if (result.ok) setUrl(result.data.url);
    else setFailed(true);
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-black">
      <video
        ref={video}
        key={url}
        src={url}
        controls
        playsInline
        preload="metadata"
        aria-label={title}
        className="aspect-video w-full"
        onLoadedMetadata={(e) => {
          if (seekTo.current > 0) e.currentTarget.currentTime = seekTo.current;
          seekTo.current = 0;
          retries.current = 0;
          setFailed(false);
        }}
        onTimeUpdate={onTimeUpdate}
        onPause={() => void save(true)}
        onEnded={() => void save(true)}
        onError={() => void onError()}
      />
      {failed && (
        <p role="alert" className="bg-red-50 px-4 py-3 text-sm text-red-700">
          The video could not be loaded. Reload the page to try again.
        </p>
      )}
    </div>
  );
}
