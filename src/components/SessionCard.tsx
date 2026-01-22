"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, truncate } from "@/lib/utils";
import { Folder, Activity, Clock, Monitor, Lock, RefreshCw, Sparkles, Bot, FileText } from "lucide-react";
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
    cliType: string;
    machine: {
      id: string;
      machineId: string;
      name: string | null;
    } | null;
    hasTranscript: boolean;
    isEncrypted: boolean;
    transcriptSizeBytes: number;
    eventCount: number;
    compactionCount: number;
    totalTokensUsed: number;
    lastActivityAt: string;
    createdAt: string;
  };
}

const statusColors: Record<SessionStatus, string> = {
  Active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  Completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Archived: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const cliConfig: Record<string, { label: string; icon: typeof Sparkles; className: string }> = {
  "claude-code": {
    label: "Claude",
    icon: Sparkles,
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  "gemini-cli": {
    label: "Gemini",
    icon: Bot,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
};

export function SessionCard({ session }: SessionCardProps) {
  const projectName = session.projectPath.split(/[/\\]/).pop() || session.projectPath;
  const cliInfo = cliConfig[session.cliType] || {
    label: session.cliType,
    icon: Bot,
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };
  const CliIcon = cliInfo.icon;

  return (
    <Link href={`/sessions/${session.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="space-y-2">
            {/* Title */}
            <h3 className="font-semibold leading-tight break-words">
              {session.title || `Session ${session.localSessionId.slice(0, 8)}`}
            </h3>

            {/* Project path */}
            <div className="flex items-start text-sm text-muted-foreground">
              <Folder className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
              <span className="break-words">{projectName}</span>
            </div>

            {/* Badges row - wraps */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  statusColors[session.status] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                }`}
              >
                {session.status}
              </span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${cliInfo.className}`}
                title={`Created with ${cliInfo.label}`}
              >
                <CliIcon className="h-3 w-3 mr-0.5" />
                {cliInfo.label}
              </span>
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

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-2 border-t">
            <span className="flex items-center">
              <Activity className="h-3 w-3 mr-1 flex-shrink-0" />
              {session.eventCount} events
            </span>
            {session.transcriptSizeBytes > 0 && (
              <span className="flex items-center">
                <FileText className="h-3 w-3 mr-1 flex-shrink-0" />
                {formatBytes(session.transcriptSizeBytes)}
              </span>
            )}
            {session.machine && (
              <span className="flex items-center">
                <Monitor className="h-3 w-3 mr-1 flex-shrink-0" />
                <span className="break-words">{session.machine.name || session.machine.machineId.slice(0, 8)}</span>
              </span>
            )}
            <span className="flex items-center">
              <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
              {formatRelativeTime(new Date(session.lastActivityAt))}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
