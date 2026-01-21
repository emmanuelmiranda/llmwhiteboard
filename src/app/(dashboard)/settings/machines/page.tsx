"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Monitor, Pencil, Check, X, Trash2 } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { apiClient, type Machine } from "@/lib/api-client";

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
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

  const startEditing = (machine: Machine) => {
    setEditingId(machine.id);
    setEditName(machine.name || machine.machineId);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = async (id: string) => {
    try {
      const updated = await apiClient.updateMachine(id, { name: editName || undefined });
      setMachines(machines.map(m => m.id === id ? { ...m, name: updated.name } : m));
      setEditingId(null);
      toast({ title: "Saved", description: "Machine name updated" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update",
        variant: "destructive",
      });
    }
  };

  const deleteMachine = async (id: string) => {
    try {
      await apiClient.deleteMachine(id);
      setMachines(machines.filter(m => m.id !== id));
      toast({ title: "Deleted", description: "Machine removed" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete machine",
        variant: "destructive",
      });
    }
  };

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
            Click the edit icon to rename a machine
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
                      {editingId === machine.id ? (
                        <div className="flex items-center space-x-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 w-48"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(machine.id);
                              if (e.key === "Escape") cancelEditing();
                            }}
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit(machine.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEditing}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <p className="font-medium">
                            {machine.name || machine.machineId}
                          </p>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEditing(machine)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
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
                  {machine.sessionCount === 0 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteMachine(machine.id)}
                      title="Delete machine"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
