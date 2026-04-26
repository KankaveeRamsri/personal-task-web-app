# Personal Task Web App

A Kanban-style task management application for organizing work across collaborative workspaces. Built with Next.js, Supabase, and Cloudflare Pages.

> Screenshots and live demo link will be added here.

## Overview

This project is a full-stack task management app that supports multiple workspaces, role-based collaboration, and a drag-and-drop Kanban board. Users can create boards, organize tasks into lists, assign team members, set priorities and due dates, and track activity — all in real time.

The app is designed as a personal portfolio project demonstrating a production-grade architecture with authentication, row-level security, and optimistic UI updates.

## Key Features

- **Authentication** — Sign up, sign in, and session management via Supabase Auth
- **Workspaces** — Create and manage separate workspaces for different projects or teams
- **Role-based access** — Owner, Admin, Member, and Viewer roles with permission enforcement at both UI and database levels
- **Boards & Lists** — Kanban boards with customizable columns (To Do, In Progress, Done, etc.)
- **Drag and Drop** — Reorder tasks and move them between lists using dnd-kit
- **Optimistic UI** — Instant visual feedback with automatic rollback on failure
- **Task Management** — Create, edit, and delete tasks with title, description, assignee, priority, and due date
- **Search & Filters** — Filter tasks by assignee, priority, due date status, or search by keyword
- **Bulk Actions** — Select multiple tasks and apply batch operations
- **Task Detail Panel** — Slide-out panel for viewing and editing task details
- **Members Panel** — View and manage workspace members and their roles
- **Dashboard Stats** — Overview of task productivity and board summaries
- **Activity Log** — Track recent changes and actions across the workspace

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Auth & Database | Supabase (Auth, PostgreSQL, RLS) |
| Drag & Drop | dnd-kit |
| Deployment | Cloudflare Pages (via OpenNext + Wrangler) |

## Architecture

### Data Model

```
User (Supabase Auth)
 └── Profile
      └── Workspace Member (role: owner / admin / member / viewer)
           └── Workspace
                └── Board
                     └── List (Kanban column)
                          └── Task (title, description, assignee, priority, due date)
```

### Key Directories

```
src/
├── app/                  # Next.js App Router pages and layouts
│   ├── auth/             # Sign-in and sign-up pages
│   └── dashboard/        # Main app (dashboard, board, actions)
├── components/
│   ├── board/            # Kanban board components
│   └── sidebar.tsx       # App navigation sidebar
├── hooks/                # Custom React hooks (board data, activities, members)
├── lib/                  # Supabase clients, permissions, activity log helpers
├── types/                # TypeScript type definitions
└── middleware.ts         # Auth-based route protection
```

### Auth Flow

- `middleware.ts` protects `/dashboard/*` routes — unauthenticated users are redirected to `/auth/sign-in`
- Authenticated users visiting `/auth/*` are redirected to `/dashboard`
- Supabase SSR client handles session cookies on every request

### Security

- **Row-Level Security (RLS)** policies on all tables enforce data access at the database level
- Permission helpers (`canEdit`, `canManage`, `isOwner`) provide frontend guardrails
- Owner role is protected from demotion or removal

## Demo Flow

1. Sign up or sign in
2. Create a workspace (you become the owner)
3. Invite members and assign roles
4. Create a board and add lists (columns)
5. Add tasks, set priority and due date, assign members
6. Drag tasks between lists to update status
7. Use search and filters to find specific tasks
8. Review dashboard stats and activity log

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- A [Supabase](https://supabase.com) account and project

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd Personal-Task-Web-App

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Environment Variables

Create a `.env.local` file based on `.env.example`:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key |

Both values are available in your Supabase project dashboard under **Settings > API**.

## Supabase Notes

### Migrations

Database migrations are in `supabase/migrations/`. They set up:

1. Core tables (workspaces, workspace_members, boards, lists, tasks)
2. User profiles
3. RLS policies for workspaces and workspace members
4. Owner role protection
5. Task activity tracking table

### Row-Level Security

All tables have RLS enabled. Users can only access data in workspaces they belong to, and actions are restricted by their assigned role. The RLS policies are defined in the migration files and are the primary security boundary.

### Running Migrations

If using the Supabase CLI:

```bash
supabase db push
```

Or apply the SQL files manually through the Supabase dashboard SQL editor.

## Deployment

This project is configured for **Cloudflare Pages** using OpenNext and Wrangler.

The deployment configuration is in `wrangler.jsonc`. To deploy:

```bash
npm run build
npx wrangler pages deploy
```

Refer to the [Next.js on Cloudflare](https://opennext.js.org/cloudflare) documentation for detailed setup instructions.

## Future Improvements

- [ ] Real-time collaboration with Supabase Realtime
- [ ] File attachments on tasks
- [ ] Board templates
- [ ] Email notifications for due dates and assignments
- [ ] Mobile-responsive optimizations
- [ ] Dark mode toggle
