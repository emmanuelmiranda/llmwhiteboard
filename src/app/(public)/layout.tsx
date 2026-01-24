"use client";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-14 flex items-center">
          <a href="/" className="flex items-center space-x-2">
            <span className="text-lg font-bold">LLM Whiteboard</span>
          </a>
          <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
            Shared View
          </span>
        </div>
      </header>
      <main className="container mx-auto py-6 px-4">{children}</main>
      <footer className="border-t py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Powered by{" "}
          <a href="/" className="underline hover:text-foreground">
            LLM Whiteboard
          </a>
        </div>
      </footer>
    </div>
  );
}
