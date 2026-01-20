"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Your account information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Account settings coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
