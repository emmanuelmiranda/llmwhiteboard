"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

function LoadingCard() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Signing in...</CardTitle>
          <CardDescription>
            Please wait while we complete your GitHub sign-in
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
  );
}

function GitHubCallbackContent() {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { handleGitHubCallback } = useAuth();

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const errorParam = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      // Handle GitHub-side errors (e.g., user cancelled)
      if (errorParam) {
        setError(errorDescription || errorParam);
        setIsProcessing(false);
        return;
      }

      if (!code || !state) {
        setError("Missing authorization code or state parameter");
        setIsProcessing(false);
        return;
      }

      try {
        await handleGitHubCallback(code, state);
        router.push("/sessions");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Authentication failed");
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [searchParams, handleGitHubCallback, router]);

  if (isProcessing) {
    return <LoadingCard />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-destructive">
            Authentication Failed
          </CardTitle>
          <CardDescription>
            {error || "An unexpected error occurred"}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/login">Return to Login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function GitHubCallbackPage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <GitHubCallbackContent />
    </Suspense>
  );
}
