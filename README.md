# 🧠 DailyOS — Personal Productivity Operating System

DailyOS is a production-grade, secure, and highly polished personal productivity operating system designed for BTech studies, developer careers, habit tracking, and goal planning.

It features a dark-first aesthetic inspired by Linear, Notion, and the Vercel Dashboard.

---

## Features

- **Advanced Task Management**: List, Kanban, Calendar, and Timeline views with drag-and-drop support, checklists, time-tracking, and priority statuses.
- **Project Workspaces**: Dedicated dashboards for academic courses, coding projects, and personal objectives.
- **Developer Mode**: In-app bug/feature tracker, changelog recorder, dev logs, and markdown code snippet manager with language syntax highlighting.
- **Study Mode**: Subject & topic tracker, revision scheduler, Pomodoro timer, and streak stats.
- **Notion-Like Notes System**: Autocached rich markdown editor with folders, search, and favorites.
- **Integrated Calendar**: Aggregated overview of tasks, deadlines, and study sessions.
- **Habits & Goals Tracker**: Daily/weekly habits with streak heatmaps, and hierarchical goals (yearly → monthly → weekly).
- **Linear-Style Command Palette**: Keyboard-shortcut driven (`Ctrl + K`) global search and navigation.
- **Productivity Analytics**: Completion rate trends, study hours logged, and habit consistency charts.

---

## Tech Stack

- **Frontend**: Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Framer Motion, Zustand.
- **Backend**: Next.js Server Actions, Prisma ORM.
- **Database**: PostgreSQL (Neon / Supabase).
- **Authentication**: Auth.js v5 (NextAuth.js v5).
- **Deployment**: Vercel.

---

## Getting Started

### Prerequisites

- Node.js v20.x or later
- npm v10.x or later
- A running PostgreSQL instance (e.g. Neon or Supabase)

### Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone <your-repository-url>
   cd dailyos
   ```

2. **Install Dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Configure Environment Variables**
   Copy the example environment file and fill in your variables:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in your:
   - `DATABASE_URL` & `DIRECT_URL` (from Neon or Supabase)
   - `AUTH_SECRET` (generate with `npx auth secret`)
   - `AUTH_GITHUB_ID` & `AUTH_GITHUB_SECRET` (from GitHub developer settings)

4. **Initialize the Database**
   Push the schema to your database and generate the Prisma Client:
   ```bash
   npx prisma db push
   ```

5. **Run the Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view your local instance.

---

## Deployment to Vercel

1. Push your repository to GitHub.
2. Go to the [Vercel Dashboard](https://vercel.com) and import the repository.
3. Under **Project Settings**, add your environment variables (`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, etc.).
4. Click **Deploy**. Vercel will build and deploy the App Router-first serverless architecture automatically.
