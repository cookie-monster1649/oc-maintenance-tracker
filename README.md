# OC Maintenance Tracker

A very basic maintenance and expense management system for an owners corporation. Tracks recurring maintenance tasks, vendors, costs and sends email reminders.

## Features

- **Task tracking**: Create recurring maintenance tasks with customizable frequencies (weekly, monthly, quarterly, etc.)
- **Smart scheduling**: Recurring tasks calculate next due date from the previous due date, not completion date
- **Vendor management**: Store vendor contact info and track task assignments
- **Cost tracking**: Monitor maintenance expenses per task and vendor
- **Category management**: User-defined categories for organising tasks
- **Dark mode**: Full support with Tailwind v4 custom variants
- **Data persistence**: JSON-based local storage with export/import via settings
- **Archiving**: Hide completed or obsolete tasks and vendors without deletion


![Screenshot 2026-05-14 at 9.08.16 pm](/Users/jjmonester/Downloads/Repositories/oc-maintenance-tracker/assets/Screenshot%202026-05-14%20at%209.08.16%E2%80%AFpm.png)

![Screenshot 2026-05-14 at 9.10.30 pm](/Users/jjmonester/Downloads/Repositories/oc-maintenance-tracker/assets/Screenshot%202026-05-14%20at%209.10.30%E2%80%AFpm.png)

![Screenshot 2026-05-14 at 9.10.45 pm](/Users/jjmonester/Downloads/Repositories/oc-maintenance-tracker/assets/Screenshot%202026-05-14%20at%209.10.45%E2%80%AFpm.png)

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4
- **State**: JSON files (`data/tasks.json`, `data/vendors.json`, `data/categories.json`)

## Getting Started

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app. No external services required locally.

### Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server on http://localhost:3000 |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint + TypeScript checks |

## Architecture

- **App layer**: Pages and layouts in `app/`. Auth guards and page structure.
- **API routes**: Backend endpoints in `app/api/`. (Cron jobs and auth hooks when migrating to production)
- **Components**: Reusable UI in `components/`. No business logic — data passed as props.
- **Lib**: Data access and utilities in `lib/`. Date math for recurring tasks, JSON I/O.
- **Types**: TypeScript definitions in `types/`.

## Key Constraints

1. **Recurring task date math**: Next due date = previous due date + frequency (not completion date)
2. **Dark mode**: Uses Tailwind v4 `@custom-variant` in globals.css (not `darkMode: "selector"`)
3. **RLS** (when on Supabase): All authenticated users can read/write tasks and vendors; admin-only delete

## Current Status

PoC is feature-complete with full UI built locally. Ready for hosting decision: validate and ship to Supabase + Vercel, or continue local iteration.
