"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, truncate } from "@/lib/utils";
import { Folder, Activity, Clock, Monitor, Lock, RefreshCw } from "lucide-react";
import type { SessionStatus } from "@/types";

interface SessionCardProps {
  session: {
    id: string;
    localSessionId: string;
    projectPath: string;
    title: string | null;
    description: string | null;
    status: SessionStatus;
    tags: string[];
    machine: {
      id: string;
      machineId: string;
      name: string | null;
    } | null;
    hasTranscript: boolean;
    isEncrypted: boolean;
    eventCount: number;
    compactionCount: number;
    totalTokensUsed: number;
    lastActivityAt: string;
    createdAt: string;
  };
}

const statusColors: Record<SessionStatus, "default" | "success" | "warning" | "secondary"> = {
  ACTIVE: "success",
  PAUSED: "warning",
  COMPLETED: "default",
  ARCHIVED: "secondary",
};

const statusLabels: Record<SessionStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

export function SessionCard({ session }: SessionCardProps) {
  const projectName = session.projectPath.split(/[/\\]/).pop() || session.projectPath;

  return (
    <Link href={`/sessions/${session.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1 min-w-0">
              <h3 className="font-semibold leading-none truncate">
                {session.title || `Session ${session.localSessionId.slice(0, 8)}`}
              </h3>
              <div className="flex items-center text-sm text-muted-foreground">
                <Folder className="h-3 w-3 mr-1" />
                <span className="truncate">{projectName}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {session.compactionCount > 0 && (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                    session.compactionCount >= 5
                      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      : session.compactionCount >= 3
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  }`}
                  title={`${session.compactionCount} compaction${session.compactionCount !== 1 ? "s" : ""} - context may be degraded`}
                >
                  <RefreshCw className="h-3 w-3 mr-0.5" />
                  {session.compactionCount}
                </span>
              )}
              {session.isEncrypted && (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
              <Badge variant={statusColors[session.status]}>
                {statusLabels[session.status]}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {session.description && (
            <p className="text-sm text-muted-foreground">
              {truncate(session.description, 100)}
            </p>
          )}

          {session.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {session.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {session.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{session.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <div className="flex items-center space-x-4">
              <span className="flex items-center">
                <Activity className="h-3 w-3 mr-1" />
                {session.eventCount} events
              </span>
              {session.machine && (
                <span className="flex items-center">
                  <Monitor className="h-3 w-3 mr-1" />
                  {session.machine.name || session.machine.machineId.slice(0, 8)}
                </span>
              )}
            </div>
            <span className="flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              {formatRelativeTime(new Date(session.lastActivityAt))}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
