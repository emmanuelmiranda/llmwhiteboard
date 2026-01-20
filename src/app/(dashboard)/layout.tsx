"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardNav } from "@/components/dashboard-nav";
import { useAuth } from "@/components/auth-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav user={user} />
      <main className="container mx-auto py-6 px-4">{children}</main>
    </div>
  );
}
