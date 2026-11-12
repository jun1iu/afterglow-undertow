"use client";

import { useStats } from "@/lib/runtime";
import { useStudio } from "@/lib/store";

/** Live renderer telemetry — frame rate, drawing-buffer size and the adaptive scale. */
export function Readout() {
  const stats = useStats();
  const paused = useStudio((s) => s.paused);
  if (!stats) return null;

  return (
    <dl className="flex h-11 items-center gap-3 rounded-full px-4 label-caps text-paper/60 tabular-nums glass">
      <div className="flex gap-1.5">
        <dt className="sr-only">Frame rate</dt>
        <dd>{paused ? "Paused" : `${stats.fps} fps`}</dd>
      </div>
      <span aria-hidden className="text-paper/25">
        /
      </span>
      <div className="flex gap-1.5">
        <dt className="sr-only">Resolution</dt>
        <dd>
          {stats.width}×{stats.height}
        </dd>
      </div>
      {stats.scale < 0.999 && (
        <>
          <span aria-hidden className="text-paper/25">
            /
          </span>
          <div className="flex gap-1.5">
            <dt className="sr-only">Render scale</dt>
            <dd title="Resolution is being lowered automatically to hold frame rate">
              {Math.round(stats.scale * 100)}%
            </dd>
          </div>
        </>
      )}
    </dl>
  );
}
