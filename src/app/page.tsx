"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Clock,
  Layout,
  Key,
  Shield,
  Zap,
  ArrowRight,
  Check,
} from "lucide-react";

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push("/sessions");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded bg-primary" />
            <span className="font-bold">LLM Whiteboard</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Stop losing track of your
          <br />
          <span className="text-primary">LLM sessions</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Visualize, resume, and share your AI-assisted work. Sync your Claude
          Code sessions across machines and never lose context again.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg">
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Button variant="outline" size="lg" asChild>
            <a
              href="https://github.com/emmanuelmiranda/llmwhiteboard"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Free to self-host. No credit card required.
        </p>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/50 py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-center text-3xl font-bold">
            Everything you need to manage LLM sessions
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            Built for developers who use AI assistants daily. Sync automatically,
            visualize your work, and resume from anywhere.
          </p>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={LayoutDashboard}
              title="Session Dashboard"
              description="View all your Claude Code sessions in one place. Search, filter, and organize by project, status, or tags."
            />
            <FeatureCard
              icon={Clock}
              title="Timeline View"
              description="See a chronological view of your AI-assisted work. Track what tools were used and when."
            />
            <FeatureCard
              icon={Layout}
              title="Visual Whiteboard"
              description="Drag and drop sessions to organize them visually. Group related sessions together."
            />
            <FeatureCard
              icon={Zap}
              title="Cross-Machine Resume"
              description="Start a session on one machine, resume it on another. Full context preserved."
            />
            <FeatureCard
              icon={Shield}
              title="End-to-End Encryption"
              description="Optional client-side encryption. Your data stays private - even we can't read it."
            />
            <FeatureCard
              icon={Key}
              title="Simple Setup"
              description="One command to configure. Your sessions sync automatically via Claude Code hooks."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-center text-3xl font-bold">
            Set up in 60 seconds
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            Three simple steps to start syncing your sessions
          </p>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            <StepCard
              number={1}
              title="Create an account"
              description="Sign up for free. Self-hosting? Skip this step."
            />
            <StepCard
              number={2}
              title="Run the CLI"
              description="npx llmwhiteboard init - enter your API token when prompted."
            />
            <StepCard
              number={3}
              title="Start coding"
              description="Use Claude Code as normal. Sessions sync automatically."
            />
          </div>

          <div className="mt-12 text-center">
            <Link href="/signup">
              <Button size="lg">
                Start Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t bg-muted/50 py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-center text-3xl font-bold">Simple pricing</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            Free for individuals. Self-host for full control.
          </p>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:max-w-4xl lg:mx-auto">
            <PricingCard
              title="Free"
              price="$0"
              description="Perfect for individual developers"
              features={[
                "Unlimited sessions",
                "Cross-machine resume",
                "End-to-end encryption",
                "Dashboard & visualizations",
              ]}
              cta="Get Started"
              ctaHref="/signup"
            />
            <PricingCard
              title="Self-Hosted"
              price="Free"
              description="Run on your own infrastructure"
              features={[
                "Everything in Free",
                "Full data control",
                "Docker Compose setup",
                "No external dependencies",
              ]}
              cta="View Setup Guide"
              ctaHref="https://github.com/emmanuelmiranda/llmwhiteboard"
              variant="outline"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center space-x-2">
              <div className="h-6 w-6 rounded bg-primary" />
              <span className="font-bold">LLM Whiteboard</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Open source. Built with Next.js, ASP.NET Core, and PostgreSQL.
            </p>
            <div className="flex items-center space-x-4">
              <a
                href="https://github.com/emmanuelmiranda/llmwhiteboard"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                GitHub
              </a>
              <a
                href="/docs"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Docs
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
        {number}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function PricingCard({
  title,
  price,
  description,
  features,
  cta,
  ctaHref,
  variant = "default",
}: {
  title: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  variant?: "default" | "outline";
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-4">
        <span className="text-4xl font-bold">{price}</span>
        {price !== "Free" && (
          <span className="text-muted-foreground">/month</span>
        )}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <ul className="mt-6 space-y-2">
        {features.map((feature) => (
          <li key={feature} className="flex items-center text-sm">
            <Check className="mr-2 h-4 w-4 text-primary" />
            {feature}
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <Button variant={variant} className="w-full" asChild>
          <Link href={ctaHref}>{cta}</Link>
        </Button>
      </div>
    </div>
  );
}
