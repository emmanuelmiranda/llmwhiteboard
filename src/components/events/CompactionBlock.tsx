"use client";

import { Zap } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { CompactionBlockProps } from "./types";

export function CompactionBlock({ event, isGlowing, showFullDetails }: CompactionBlockProps) {
  return (
    <div
      className={`border border-amber-300 dark:border-amber-700 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 ${
        isGlowing ? "ring-2 ring-green-500 ring-opacity-50 animate-pulse" : ""
      }`}
    >
      <div className="flex items-center space-x-3">
        <Zap className="h-4 w-4 text-amber-500 flex-shrink-0" />
        <div className="flex-1">
          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
            Context Compaction
          </span>
          {showFullDetails && event.summary && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              {event.summary}
            </p>
          )}
        </div>
        <span className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap">
          {formatRelativeTime(new Date(event.createdAt))}
        </span>
      </div>
    </div>
  );
}
