# LLM Whiteboard

> Stop losing track of your LLM sessions. Visualize, resume, and share your AI-assisted work.

A web-based dashboard for visualizing, managing, and resuming Claude Code (and other LLM) sessions across machines.

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Next.js         │     │  ASP.NET Core    │     │  PostgreSQL      │
│  (Frontend)      │────►│  Web API (C#)    │────►│                  │
│  :22000          │     │  :22001          │     │  :22432          │
└──────────────────┘     └──────────────────┘     └──────────────────┘
        ▲                        ▲
        │                        │
   Browser               CLI (llmwhiteboard)
```

## Features

- **Session Dashboard** - View all your Claude Code sessions in one place
- **Timeline View** - Chronological view of your AI-assisted work
- **Visual Whiteboard** - Drag and drop to organize sessions
- **Cross-Machine Resume** - Start on one machine, resume on another
- **End-to-End Encryption** - Optional client-side encryption for privacy
- **Multi-threaded Backend** - C# ASP.NET Core for heavy workloads

## Ports

| Service              | Port  |
|----------------------|-------|
| Frontend (Next.js)   | 22000 |
| Backend API (C#)     | 22001 |
| PostgreSQL           | 22432 |

## Quick Start

### 1. Create an account

Visit `http://localhost:22000` after starting the services.

### 2. Install the CLI

```bash
npx llmwhiteboard init
```

Enter your API token when prompted. This configures Claude Code hooks to sync your sessions automatically.

### 3. Start using Claude Code

Your sessions will automatically appear in the dashboard.

## CLI Commands

```bash
npx llmwhiteboard init          # Configure and install hooks
npx llmwhiteboard list          # List your synced sessions
npx llmwhiteboard resume <id>   # Resume a session on this machine
npx llmwhiteboard status        # Show configuration status
npx llmwhiteboard logout        # Remove configuration
npx llmwhiteboard rotate-key    # Rotate encryption key
```

## Self-Hosting

### Prerequisites

- Docker and Docker Compose
- .NET 8 SDK (for development)
- Node.js 20+ (for development)

### Quick Setup (Windows)

Use the provided batch scripts for easy setup:

```batch
setup.bat          # Initial setup - creates .env, generates JWT key, starts all containers
dev.bat            # Development mode - starts only PostgreSQL, run backend/frontend manually
stop.bat           # Stop all running containers
```

### Setup with Docker (Manual)

1. Clone the repository:

```bash
git clone https://github.com/emmanuelmiranda/llmwhiteboard.git
cd llmwhiteboard
```

2. Copy the environment file:

```bash
cp .env.example .env
```

3. Generate a JWT secret:

```bash
openssl rand -base64 32
```

Add it to your `.env` file as `JWT_KEY`.

4. Start all services:

```bash
docker-compose up -d
```

5. Access the dashboard at `http://localhost:22000`

### Development Setup

**Start PostgreSQL:**

```bash
docker-compose up -d postgres
```

**Run the C# Backend:**

```bash
cd backend/LlmWhiteboard.Api
dotnet run
```

The API will be available at `http://localhost:22001`
Swagger UI: `http://localhost:22001/swagger`

**Run the Next.js Frontend:**

```bash
npm install
npm run dev
```

The frontend will be available at `http://localhost:22000`

**Run the CLI (development):**

```bash
cd cli
npm install
npm run build
node dist/index.js status
```

## Tech Stack

| Layer    | Technology         | Port  |
|----------|-------------------|-------|
| Frontend | Next.js 14        | 22000 |
| Backend  | ASP.NET Core 8    | 22001 |
| Database | PostgreSQL 16     | 22432 |
| ORM      | Entity Framework  |       |
| Auth     | JWT               |       |
| CLI      | Node.js/TypeScript|       |

## Project Structure

```
llmwhiteboard/
├── src/                          # Next.js frontend
│   ├── app/                      # App router pages
│   │   ├── (auth)/              # Login/signup pages
│   │   ├── (dashboard)/         # Dashboard pages
│   │   └── page.tsx             # Landing page
│   ├── components/              # React components
│   └── lib/                     # Utilities
│       └── api-client.ts        # API client for C# backend
│
├── backend/                      # C# ASP.NET Core backend
│   └── LlmWhiteboard.Api/
│       ├── Controllers/         # API endpoints
│       ├── Models/              # Entity models
│       ├── Services/            # Business logic
│       ├── Data/                # DbContext
│       ├── Dtos/                # Data transfer objects
│       └── Middleware/          # Custom middleware
│
├── cli/                          # CLI tool (Node.js)
│   └── src/
│       ├── commands/            # CLI commands
│       └── lib/                 # CLI utilities
│
├── docs/                         # Documentation
└── docker-compose.yml           # Container orchestration
```

## API Endpoints

### Auth

- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/signup` - Create new account

### Sessions (JWT Auth)

- `GET /api/sessions` - List sessions
- `GET /api/sessions/{id}` - Get session detail
- `PATCH /api/sessions/{id}` - Update session
- `DELETE /api/sessions/{id}` - Delete session

### Sync (API Token Auth - CLI)

- `POST /api/sync` - Receive events from Claude Code hooks
- `POST /api/sync/transcript` - Upload session transcript
- `GET /api/sync/transcript/{id}` - Download transcript
- `GET /api/sync/sessions` - List sessions

### Tokens (JWT Auth)

- `GET /api/tokens` - List API tokens
- `POST /api/tokens` - Create API token
- `DELETE /api/tokens?id=` - Revoke token

### Machines (JWT Auth)

- `GET /api/machines` - List connected machines

### Events (JWT Auth)

- `GET /api/events` - List session events

## End-to-End Encryption

LLM Whiteboard supports optional client-side encryption:

```bash
npx llmwhiteboard init --enable-encryption
```

When enabled:
- Your encryption key is generated and stored locally
- Transcripts are encrypted before upload (AES-256-GCM)
- The server only sees encrypted blobs
- Only you can decrypt your sessions

**Important**: Back up your encryption key! Without it, you cannot decrypt your sessions.

## Publishing to GitHub Container Registry (GHCR)

Build and publish container images to GHCR for deployment on other machines.

### Prerequisites

1. Create a GitHub Personal Access Token (PAT) with `write:packages` scope
2. Login to GHCR:

```bash
echo YOUR_GITHUB_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### Publish Images

Edit `publish.bat` and set your `GITHUB_OWNER` variable, then:

```batch
# Publish all components with 'latest' tag
publish.bat latest all

# Publish specific components
publish.bat v1.0.0 frontend    # Frontend only
publish.bat v1.0.0 backend     # Backend only

# Publish all with version tag
publish.bat v1.0.0 all
```

This will push images to:
- `ghcr.io/YOUR_USERNAME/llmwhiteboard-frontend:TAG`
- `ghcr.io/YOUR_USERNAME/llmwhiteboard-backend:TAG`

## Deploying to Another Machine

### Option 1: Manual Deployment

1. Copy these files to your target machine:
   - `docker-compose.ghcr.yml`
   - `.env.production.example`

2. On the target machine:

```bash
# Rename and configure environment
cp .env.production.example .env
nano .env  # Edit with your settings

# Login to GHCR (if images are private)
echo YOUR_GITHUB_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Images are pre-configured to use ghcr.io/emmanuelmiranda/llmwhiteboard-*

# Pull and start containers
docker-compose -f docker-compose.ghcr.yml pull
docker-compose -f docker-compose.ghcr.yml up -d
```

### Option 2: Automated Deployment (Windows)

Edit `deploy-remote.bat` with your SSH credentials and run:

```batch
deploy-remote.bat v1.0.0
```

This copies deployment files to the remote machine and provides next steps.

### Environment Configuration

Key environment variables for production (`.env`):

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_KEY` | Secret key for JWT tokens | `openssl rand -base64 32` |
| `POSTGRES_PASSWORD` | Database password | `secure-password-here` |
| `API_URL` | Public URL of backend API | `http://your-server:22001` |
| `FRONTEND_URL` | Public URL of frontend | `http://your-server:22000` |
| `VERSION` | Container image version | `latest` or `v1.0.0` |

### Production Checklist

- [ ] Change `JWT_KEY` to a secure random value
- [ ] Change `POSTGRES_PASSWORD` to a secure password
- [ ] Update `API_URL` and `FRONTEND_URL` to your server's address
- [ ] Configure firewall to allow ports 22000 and 22001
- [ ] (Optional) Set up reverse proxy (nginx/traefik) for HTTPS
- [ ] (Optional) Configure backup for PostgreSQL data volume

## Batch Scripts Reference

| Script | Description |
|--------|-------------|
| `setup.bat` | Initial setup and start all services |
| `dev.bat` | Start PostgreSQL only for development |
| `stop.bat` | Stop all running containers |
| `publish.bat` | Build and push images to GHCR |
| `deploy-remote.bat` | Deploy to remote machine via SSH |

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

By contributing, you agree to the Contributor License Agreement (CLA), which ensures we can continue to offer LLM Whiteboard as both an open-source project and a managed service.

## License

This project is licensed under the **Elastic License 2.0** - see [LICENSE](LICENSE) for details.

**You can:**
- Use the software for free
- Self-host for personal or business use
- Modify the source code
- Contribute improvements

**You cannot:**
- Offer LLM Whiteboard as a managed/hosted service to third parties
- Remove licensing notices

For managed hosting, use [llmwhiteboard.com](https://llmwhiteboard.com).
