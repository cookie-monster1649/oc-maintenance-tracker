# OC Maintenance Tracker

A maintenance and expense management system for owners corporations. Tracks recurring maintenance tasks, vendors, costs, and integrates with Paperless-ngx for automatic document matching.

## Features

- **Task tracking**: Create recurring maintenance tasks with customizable frequencies (weekly, monthly, quarterly, etc.)
- **Smart scheduling**: Recurring tasks calculate next due date from the previous due date, not completion date
- **Vendor management**: Store vendor contact info and track task assignments
- **Cost tracking**: Monitor maintenance expenses per task and vendor
- **Category management**: User-defined categories for organising tasks
- **Document integration**: Automatic document matching from Paperless-ngx with AI-powered suggestions
- **Dark mode**: Full support with Tailwind CSS v4
- **Data persistence**: JSON-based local storage with export/import via settings
- **Archiving**: Hide completed or obsolete tasks and vendors without deletion

## Screenshots

![Home Page](/assets/Screenshot%202026-05-14%20at%209.08.16%E2%80%AFpm.png)

![Tasks View](/assets/Screenshot%202026-05-14%20at%209.10.30%E2%80%AFpm.png)

![Vendor Details](/assets/Screenshot%202026-05-14%20at%209.10.45%E2%80%AFpm.png)

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4
- **Data Storage**: JSON files (`data/tasks.json`, `data/vendors.json`, `data/categories.json`, `data/line-items.json`)
- **Document Integration**: Paperless-ngx API

## Getting Started

### Option 1: Docker Compose (Recommended)

The quickest way to get started. Requires Docker and Docker Compose.

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/oc-maintenance-tracker.git
   cd oc-maintenance-tracker
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your Paperless-ngx configuration:
   ```env
   PAPERLESS_BASE_URL=http://your-paperless-instance:8000/
   PAPERLESS_API_TOKEN=your_token_here
   NEXT_PUBLIC_DOCUMENT_DOMAIN=http://your-paperless-instance:8000/
   NEXT_PUBLIC_GOD_MODE_PASSWORD=your_admin_password
   ```

3. **Start the application**
   ```bash
   docker-compose up
   ```

   The app will be available at [http://localhost:3000](http://localhost:3000)

   Your data will be persisted in the `./data` directory on your host.

### Option 2: Local Development

Requires Node.js 20+ and npm.

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure your `.env.local` with Paperless-ngx connection details.

3. **Start development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint + TypeScript checks |

## Architecture

### Directory Structure

```
app/
├── api/              # Backend endpoints
├── components/       # Reusable UI components
├── (pages)          # App pages (tasks, vendors, line-items, etc.)
└── contexts/        # React context providers

lib/
├── cache.ts         # Client-side caching utilities
├── colors.ts        # Color system and utilities
├── data.ts          # Data fetching hooks
├── line-items.ts    # Line item logic
├── recommendations.ts # AI-powered document matching
├── tasks.ts         # Task date math and utilities
└── vendors.ts       # Vendor utilities

data/               # JSON data files (created at runtime)
├── tasks.json
├── vendors.json
├── categories.json
└── line-items.json
```

### Key Patterns

- **API Routes**: JSON endpoints in `app/api/` handle CRUD operations
- **Client Data Fetching**: `useCachedData` hook with client-side caching
- **Form State**: Local component state with unsaved changes confirmation
- **Date Handling**: `date-fns` for consistent date operations with OC year awareness (April 1 - March 31)

## Configuration

### Environment Variables

See `.env.example` for all available options:

- `PAPERLESS_BASE_URL`: URL to your Paperless-ngx instance
- `PAPERLESS_API_TOKEN`: API token from Paperless-ngx
- `NEXT_PUBLIC_DOCUMENT_DOMAIN`: Public document serving URL (optional)
- `NEXT_PUBLIC_GOD_MODE_PASSWORD`: Admin feature password

## Data Storage

By default, the app uses local JSON files for storage:

```
data/
├── tasks.json       # All maintenance tasks
├── vendors.json     # Vendor contact information
├── categories.json  # Task categories
└── line-items.json  # Major line items (building assets)
```

On startup, the app creates these files if they don't exist. Data is persisted automatically.

## Development

### Adding a New Feature

1. Define your data model in `lib/[feature].ts`
2. Create API routes in `app/api/[feature]/`
3. Build UI components in `app/components/`
4. Integrate into pages with data fetching hooks
5. Test in the UI with dev server

### Code Standards

- **TypeScript**: All code is type-checked
- **Styling**: Tailwind utility classes (no custom CSS)
- **Components**: Reusable, data-driven, no business logic in UI
- **Naming**: Clear, descriptive names for files, functions, and variables

## Troubleshooting

### Paperless-ngx Connection Issues

If the app can't connect to Paperless-ngx:
1. Verify `PAPERLESS_BASE_URL` is correct and accessible
2. Check `PAPERLESS_API_TOKEN` is valid (generate a new one if needed)
3. Ensure your Paperless instance is running and accessible from the Docker container

### Data Issues

If you have corrupted or inconsistent data:
1. Stop the application
2. Delete the `data/` directory
3. Restart the application (fresh JSON files will be created)
4. Re-import or re-create your data

## Support

For issues, feature requests, or questions, please open an issue on GitHub.

## License

[Add your license here]
