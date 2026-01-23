"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/components/auth-provider";
import { apiClient, type AuthProviders } from "@/lib/api-client";
import { Github, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [providersLoading, setProvidersLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const { login, loginWithGitHub } = useAuth();

  useEffect(() => {
    apiClient
      .getAuthProviders()
      .then(setProviders)
      .catch(() => {
        toast({
          title: "Error",
          description: "Failed to load authentication options",
          variant: "destructive",
        });
      })
      .finally(() => setProvidersLoading(false));
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      router.push("/sessions");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Invalid username or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHubLogin = async () => {
    setIsGitHubLoading(true);
    try {
      await loginWithGitHub();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initiate GitHub login",
        variant: "destructive",
      });
      setIsGitHubLoading(false);
    }
  };

  if (providersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <Card className="w-full max-w-md">
          <CardContent className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasGitHub = providers?.gitHub ?? false;
  const hasEmail = providers?.email ?? false;
  const hasBothProviders = hasGitHub && hasEmail;

  if (!hasGitHub && !hasEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Sign in unavailable</CardTitle>
            <CardDescription>
              No authentication methods are configured. Please contact the administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
          <CardDescription>
            {hasEmail
              ? "Enter your username and password to access your sessions"
              : "Sign in with GitHub to access your sessions"}
          </CardDescription>
        </CardHeader>

        {hasGitHub && (
          <CardContent className="space-y-4">
            <Button
              type="button"
              variant={hasEmail ? "outline" : "default"}
              className="w-full"
              onClick={handleGitHubLogin}
              disabled={isGitHubLoading || isLoading}
            >
              {isGitHubLoading ? (
                "Redirecting..."
              ) : (
                <>
                  <Github className="mr-2 h-4 w-4" />
                  Continue with GitHub
                </>
              )}
            </Button>

            {hasBothProviders && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or continue with email
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        )}

        {hasEmail && (
          <form onSubmit={handleSubmit}>
            <CardContent className={`space-y-4 ${hasGitHub ? "pt-0" : ""}`}>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="your username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
