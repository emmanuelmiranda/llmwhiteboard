"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Copy, Check, Terminal, Key, Settings, RefreshCw } from "lucide-react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleCopy} className="h-6 w-6">
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

function CodeBlock({ children, copyable = true }: { children: string; copyable?: boolean }) {
  return (
    <div className="relative group">
      <pre className="bg-muted p-3 rounded-md overflow-x-auto text-sm">
        <code>{children}</code>
      </pre>
      {copyable && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={children} />
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Setup Guide</h1>
        <p className="text-muted-foreground mt-2">
          Follow these instructions to sync your Claude Code or Gemini CLI sessions to LLM Whiteboard.
        </p>
      </div>

      {/* Quick Setup */}
      <Card className="border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Quick Setup
          </CardTitle>
          <CardDescription>
            One command to get started. The CLI handles everything including hook installation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="font-medium">Prerequisites:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Node.js 18+ installed</li>
              <li>Claude Code or Gemini CLI installed</li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="font-medium">Step 1: Run the Setup Command</p>
            <CodeBlock>{`npx llmwhiteboard init`}</CodeBlock>
            <p className="text-sm text-muted-foreground">
              If you&apos;re not logged in, the CLI will prompt you to authenticate via GitHub (recommended) or enter a token manually.
            </p>
          </div>

          <div className="space-y-3">
            <p className="font-medium">Alternative: Login First</p>
            <p className="text-sm text-muted-foreground">
              You can authenticate separately before running init:
            </p>
            <CodeBlock>{`npx llmwhiteboard login`}</CodeBlock>
            <p className="text-sm text-muted-foreground">
              This command will:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
              <li>Save your token to <code className="bg-muted px-1 rounded">~/.llmwhiteboard/config.json</code></li>
              <li>Install Claude Code hooks globally</li>
              <li>Use the machine ID you provide (or auto-generate one)</li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="font-medium">Step 3: Restart Claude Code</p>
            <p className="text-sm text-muted-foreground">
              Restart Claude Code to load the new hooks. New sessions will automatically sync.
            </p>
          </div>

          <div className="space-y-3">
            <p className="font-medium">Verify Setup</p>
            <CodeBlock>{`npx llmwhiteboard status`}</CodeBlock>
          </div>
        </CardContent>
      </Card>

      {/* CLI Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            CLI Options
          </CardTitle>
          <CardDescription>
            All available flags for the init command.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CodeBlock>{`npx llmwhiteboard init [options]

Options:
  -t, --token <token>       API token (or login interactively)
  -m, --machine-id <id>     Machine name (default: auto-generated)
  -u, --url <url>           API URL (default: https://api.llmwhiteboard.com)
  -p, --project             Install hooks for current project only
  -e, --enable-encryption   Enable end-to-end encryption
  --cli <type>              CLI type: claude-code (default) or gemini-cli
  --hooks-only              Just reinstall hooks without reconfiguring
  --no-url-notify           Disable session URL notification after each response`}</CodeBlock>
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="font-medium">Hook Installation:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li><strong>Default</strong>: Installs globally to <code className="bg-background px-1 rounded">~/.claude/settings.json</code> (works everywhere)</li>
              <li><strong>--project</strong>: Installs to <code className="bg-background px-1 rounded">.claude/settings.local.json</code> (current directory only)</li>
            </ul>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="font-medium">Gemini CLI Support:</p>
            <p className="text-sm text-muted-foreground">
              To use with Gemini CLI, add <code className="bg-background px-1 rounded">--cli gemini-cli</code> to your init command:
            </p>
            <CodeBlock copyable={false}>{`npx llmwhiteboard init --cli gemini-cli --token YOUR_TOKEN`}</CodeBlock>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="font-medium">Self-Hosted:</p>
            <p className="text-sm text-muted-foreground">
              Use <code className="bg-background px-1 rounded">--url</code> to point to your own server:
            </p>
            <CodeBlock copyable={false}>{`npx llmwhiteboard init --url https://api.your-domain.com ...`}</CodeBlock>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="font-medium">Reinstall Hooks:</p>
            <p className="text-sm text-muted-foreground">
              Use <code className="bg-background px-1 rounded">--hooks-only</code> to reinstall hooks without reconfiguring. Useful after CLI updates:
            </p>
            <CodeBlock copyable={false}>{`npx llmwhiteboard init --hooks-only`}</CodeBlock>
          </div>
        </CardContent>
      </Card>

      {/* Login Command */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Login Command
          </CardTitle>
          <CardDescription>
            Authenticate with LLM Whiteboard via GitHub or manual token entry.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CodeBlock>{`npx llmwhiteboard login [options]

Options:
  -t, --token <token>       API token (manual entry)
  -u, --url <url>           API URL (default: https://api.llmwhiteboard.com)
  -m, --machine-id <id>     Machine name for this token`}</CodeBlock>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="font-medium">GitHub Device Flow (Recommended):</p>
            <p className="text-sm text-muted-foreground">
              Running <code className="bg-background px-1 rounded">llmwhiteboard login</code> without a token will initiate GitHub Device Flow:
            </p>
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1 mt-2">
              <li>The CLI displays a verification URL and code</li>
              <li>Open the URL in your browser and enter the code</li>
              <li>Authorize LLM Whiteboard to access your GitHub account</li>
              <li>The CLI automatically receives your credentials</li>
            </ol>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="font-medium">Manual Token Entry:</p>
            <p className="text-sm text-muted-foreground">
              If you prefer to use a token, you can pass it directly or generate one at{" "}
              <a href="/settings/tokens" className="text-primary underline">Settings &gt; API Tokens</a>:
            </p>
            <CodeBlock copyable={false}>{`npx llmwhiteboard login --token lwb_sk_YOUR_TOKEN`}</CodeBlock>
          </div>
        </CardContent>
      </Card>

      {/* API Token */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Token
          </CardTitle>
          <CardDescription>
            Generate tokens to authenticate your CLI with LLM Whiteboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Go to{" "}
            <a href="/settings/tokens" className="text-primary underline">
              Settings &gt; API Tokens
            </a>{" "}
            to create a new token. Tokens are used to authenticate your CLI when syncing sessions.
          </p>
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm font-medium">Token Format</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tokens start with <code className="bg-background px-1 rounded">lwb_sk_</code> followed by 64 hexadecimal characters.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Resume Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Resume Sessions
          </CardTitle>
          <CardDescription>
            Continue sessions from other machines.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            To resume a session that was started on another machine:
          </p>
          <CodeBlock>{`llmwhiteboard resume <session-id>`}</CodeBlock>
          <p className="text-sm text-muted-foreground">
            This downloads the session transcript and places it in your local data directory.
            Then use your CLI&apos;s continue feature:
          </p>
          <CodeBlock>{`# Claude Code
claude --continue <session-id>

# Gemini CLI
gemini --continue <session-id>`}</CodeBlock>
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm font-medium">List Available Sessions</p>
            <CodeBlock>{`llmwhiteboard list`}</CodeBlock>
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="font-medium">Hooks not firing?</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Make sure <code className="bg-muted px-1 rounded">llmwhiteboard-hook</code> is in your PATH</li>
              <li>Restart Claude Code after modifying settings.json</li>
              <li>Check that the config file exists at <code className="bg-muted px-1 rounded">~/.llmwhiteboard/config.json</code></li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-medium">Sessions not appearing?</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Verify your API token is valid in Settings &gt; Tokens</li>
              <li>Check the API URL in your config matches <code className="bg-muted px-1 rounded">https://api.llmwhiteboard.com</code></li>
              <li>Run <code className="bg-muted px-1 rounded">llmwhiteboard status</code> to verify configuration</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-medium">Need to reconfigure?</p>
            <CodeBlock>{`llmwhiteboard logout
llmwhiteboard init`}</CodeBlock>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Reference</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="font-medium">Config File Location</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Linux/macOS: <code className="bg-muted px-1 rounded">~/.llmwhiteboard/config.json</code></li>
              <li>Windows: <code className="bg-muted px-1 rounded">%USERPROFILE%\.llmwhiteboard\config.json</code></li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-medium">Config File Schema</p>
            <CodeBlock>{`{
  "token": "lwb_sk_...",      // Required: Your API token
  "apiUrl": "https://api.llmwhiteboard.com",  // API endpoint
  "machineId": "My-MacBook",  // Unique identifier for this machine
  "cliType": "claude-code",   // CLI type: claude-code or gemini-cli
  "encryption": {             // Optional: End-to-end encryption
    "enabled": true,
    "keyPath": "~/.llmwhiteboard/encryption.key"
  }
}`}</CodeBlock>
          </div>

          <div className="space-y-2">
            <p className="font-medium">Hooks Location</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><strong>Claude Code:</strong> <code className="bg-muted px-1 rounded">~/.claude/settings.json</code> or <code className="bg-muted px-1 rounded">.claude/settings.local.json</code></li>
              <li><strong>Gemini CLI:</strong> <code className="bg-muted px-1 rounded">~/.gemini/settings.json</code> or <code className="bg-muted px-1 rounded">.gemini/settings.local.json</code></li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
