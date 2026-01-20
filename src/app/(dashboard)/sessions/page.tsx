"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SessionCard } from "@/components/SessionCard";
import { useToast } from "@/components/ui/use-toast";
import { Search, LayoutGrid, List, Inbox } from "lucide-react";
import { apiClient, type Session } from "@/lib/api-client";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { toast } = useToast();

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getSessions({
        search: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      setSessions(data.sessions || []);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load sessions",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSessions();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="text-muted-foreground">
            View and manage your Claude Code sessions
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Paused">Paused</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 rounded-lg bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12">
          <Inbox className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No sessions yet</h3>
          <p className="text-muted-foreground mt-2">
            {search
              ? "No sessions match your search"
              : "Run the CLI to sync your first session"}
          </p>
        </div>
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              : "space-y-4"
          }
        >
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}
