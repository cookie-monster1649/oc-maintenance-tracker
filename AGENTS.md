# Agent Rules for OC Maintenance Tracker

## Framework: Next.js 16 (App Router)

This is a modern Next.js 16 application with breaking changes from older versions. Before writing code:
- Read the Next.js 16 migration guide in the docs
- Check `node_modules/next/dist/docs/` for API changes
- Pay attention to deprecation notices in error messages

## Project Architecture

### Core Structure
- **App Router**: All pages and layouts in `app/` directory
- **API Routes**: Backend endpoints in `app/api/`
- **Components**: Reusable UI in `app/components/` (data passed as props, no business logic)
- **Lib**: Data access and utilities in `lib/`
- **Types**: TypeScript definitions in `lib/` and component interfaces

### State Management
- JSON file-based storage: `data/tasks.json`, `data/vendors.json`, `data/categories.json`, `data/line-items.json`
- Client-side caching via `lib/cache.ts` utilities
- Fetch-based data loading with `useCachedData` hook

### Styling
- **Tailwind CSS v4** with custom variants
- **Dark mode**: Uses `@custom-variant` in `globals.css` (not `darkMode: "selector"`)
- Consistent spacing and color system via Tailwind utilities

## Critical Implementation Details

### Recurring Task Date Math
**Next due date = previous due date + frequency** (NOT completion date)
- This is non-negotiable for the business logic
- Date calculations use `date-fns` library
- OC year spans April 1 - March 31 (Australian fiscal year)

### Document Linking
- Documents can be linked to tasks, line items, or vendors
- `is_matched` status is true if linked to ANY of these (not just tasks)
- Smart actions provide AI-suggested completions based on document content

### Form State Management
- Modals use local state with confirmation on unsaved changes
- `useSearchParams` for query string filtering and state persistence
- Pattern-based task filtering on detail pages

## Common Patterns

### Adding a New Feature
1. Define API endpoint in `app/api/[resource]/route.ts`
2. Create TypeScript interfaces in `lib/[resource].ts`
3. Implement data access functions in `lib/[resource].ts`
4. Create UI component in `app/components/[Feature].tsx`
5. Integrate into page with proper state management

### Working with Forms
- Use controlled components with `useState`
- Implement "discard unsaved changes" confirmation
- Pass setter function directly for clean prop contracts

### Date Handling
- Always parse dates with proper timezone handling
- Use `date-fns` for consistent formatting across the app
- Account for OC year boundaries in filters

## Code Standards

### No Tests
This is a PoC application without test infrastructure. Focus on:
- TypeScript for compile-time safety
- User testing through the UI
- Clear code structure for maintainability

### Type Safety
- Use TypeScript interfaces for all data structures
- Avoid `any` types
- Define specific types for API responses

### Component Design
- Keep components focused and single-responsibility
- No business logic in presentation components
- Pass data via props, not derived from state

## ESLint Configuration

Minimal ESLint setup includes:
- Next.js core web vitals recommended rules
- TypeScript strict checking
- Standard global ignores for build artifacts

The configuration prioritizes clean, error-free code without excess restrictions.
