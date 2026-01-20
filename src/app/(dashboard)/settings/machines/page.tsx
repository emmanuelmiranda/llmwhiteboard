"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Monitor } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { apiClient, type Machine } from "@/lib/api-client";

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        const data = await apiClient.getMachines();
        setMachines(data.machines || []);
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load machines",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchMachines();
  }, [toast]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Machines</h1>
        <p className="text-muted-foreground">
          Machines that have synced sessions to your account
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connected Machines</CardTitle>
          <CardDescription>
            All machines that have synced sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : machines.length === 0 ? (
            <div className="text-center py-8">
              <Monitor className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No machines yet</p>
              <p className="text-sm text-muted-foreground">
                Run the CLI to connect your first machine
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {machines.map((machine) => (
                <div
                  key={machine.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <Monitor className="h-8 w-8 text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="font-medium">
                        {machine.name || `Machine ${machine.machineId.slice(0, 8)}`}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>{machine.sessionCount} sessions</span>
                        {machine.lastSeenAt && (
                          <span>
                            Last seen {formatRelativeTime(new Date(machine.lastSeenAt))}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
