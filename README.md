# FuelWatch PH

FuelWatch PH is a community-powered fuel price and station monitoring web app for the Philippines. It helps users browse fuel stations, compare prices, discover stations on the map, report updates, share station experiences, and lets Admin/LGU reviewers moderate and manage platform data.

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui + Radix UI
- TanStack Query
- React Router
- Supabase
  - Auth
  - Postgres
  - Storage
  - SQL/RPC functions
- Google Maps JavaScript API
- Overpass API for discovered fuel stations
- Nominatim for reverse geocoding

## Core Features

- Public station browsing on the homepage and search page
- Interactive `/map` view with listed and discovered fuel stations
- Fuel price reporting flow with Standard Report and Easy Report
- Station experience submission and moderation
- Admin dashboard for stations, reports, discovery, users, platform controls, and donation gateways
- LGU dashboard for scoped station and report review
- Embedded stations list page
- Donation page with configurable gateways
- Maintenance mode and feature flags via database

## Project Structure

```text
src/
  components/              Reusable UI and feature components
  contexts/                Auth and theme providers
  hooks/                   Shared data-fetching and feature hooks
  integrations/supabase/   Typed Supabase client
  lib/                     Shared utilities and external API helpers
  pages/                   Route-level pages
  types/                   App-level TypeScript types

supabase/
  config.toml              Supabase local config
  migrations/              SQL schema, policies, RPCs, and seeds
```

## Requirements

Before running the project locally, make sure you have:

- Node.js 20+ recommended
- npm 10+ recommended
- A Supabase project
- A Google Maps JavaScript API key
- A Google OAuth client ID for sign-in
- Supabase CLI if you plan to run or push migrations

## Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd fuel-finder-ph-v2
```

2. Install dependencies:

```bash
npm install
```

3. Create your environment file:

```bash
touch .env
```

The app already ignores `.env` in git.

4. Fill in the required environment variables.

5. Start the development server:

```bash
npm run dev
```

The app will usually be available at:

```text
http://localhost:5173
```

## Environment Variables

Set these values in your local `.env` file:

```env
VITE_SUPABASE_PROJECT_ID=your_supabase_project_id
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key

VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_javascript_api_key
```

### Currently referenced in the app

The app also currently references:

```env
VITE_GOOGLE_CLIENT_SECRET=
```

That value should not normally live in a browser-exposed frontend app. If you keep using Google OAuth on the frontend, prefer using only the client ID unless you have a very specific reason and a safe architecture around it.

## Supabase Setup

This app relies heavily on Supabase for auth, data, moderation workflows, and storage.

### What Supabase is used for

- `auth.users` and app profiles
- gas stations and fuel reports
- LGU scope and role management
- feature flags and maintenance mode
- donation gateways
- station experiences
- file uploads:
  - fuel report photos
  - donation QR images
  - station experience photos

### Apply database migrations

If you are connecting to your own Supabase project, run:

```bash
supabase db push
```

### Local Supabase workflow

If you use local Supabase development:

```bash
supabase start
supabase db reset
```

Use that only if you intentionally want to rebuild your local database state.

## Available Scripts

### Development

```bash
npm run dev
```

Starts the Vite dev server.

### Production build

```bash
npm run build
```

Builds the production bundle into `dist/`.

### Preview production build

```bash
npm run preview
```

Serves the built app locally for preview.

### Lint

```bash
npm run lint
```

Runs ESLint.

### Tests

```bash
npm run test
```

Runs Vitest in non-watch mode.

```bash
npm run test:watch
```

Runs Vitest in watch mode.

## Main Routes

### Public

- `/` Homepage station list
- `/map` Interactive map
- `/search` Search and filter stations
- `/report` Fuel reporting flow
- `/station-experiences` Public station experience page
- `/donate` Donation page
- `/embed/stations` Embeddable station list

### Admin

- `/admin`
- `/admin/stations`
- `/admin/stations-summary`
- `/admin/station-discovery`
- `/admin/reports`
- `/admin/station-experiences`
- `/admin/platform-controls`

### LGU

- `/lgu`
- `/lgu/stations`
- `/lgu/stations-summary`
- `/lgu/reports`
- `/lgu/station-experiences`

## External Services

### Google Maps JavaScript API

Used for:

- map rendering
- markers
- directions
- interactive location pickers

### Overpass API

Used for:

- discovering nearby or visible `amenity=fuel` stations on the map

### Nominatim

Used for:

- reverse geocoding
- province/location detection flows without relying fully on Google geocoding

## How Data Flows

High-level developer flow:

```text
Page -> Component -> Hook/Lib -> Supabase or external API -> mapped result -> UI
```

Typical examples:

- Homepage/search:
  - page -> browse hooks -> Supabase station queries/RPC -> station list UI
- Map:
  - `StationMap` -> discovery helpers -> Overpass/Nominatim/Google Maps -> markers and popups
- Reports:
  - `ReportForm` -> validation helpers + Supabase insert/RPC -> review flow
- Admin/LGU moderation:
  - dashboard pages -> shared admin hooks -> Supabase tables/RPC/policies

## Dependencies

Notable runtime dependencies:

- `@supabase/supabase-js`
- `@tanstack/react-query`
- `@react-google-maps/api`
- `@react-oauth/google`
- `react-router-dom`
- `framer-motion`
- `lucide-react`
- `sonner`
- `zod`

Notable development dependencies:

- `vite`
- `typescript`
- `eslint`
- `vitest`
- `@playwright/test`
- `tailwindcss`

## Build Notes

You may see these warnings during production build:

- `lottie-web` uses `eval`
- large Vite chunk size warnings

Those warnings currently do not block a successful build, but they are worth revisiting later for optimization and hardening.

## Recommended Developer Checklist

When working on the project locally:

1. Install dependencies with `npm install`
2. Set your `.env`
3. Run `supabase db push` if your schema needs to match the latest migrations
4. Start the app with `npm run dev`
5. Before merging changes, run:

```bash
./node_modules/.bin/tsc --noEmit
npm run build
```

## Notes

- This project stores some user/session state in the browser via Supabase Auth and app-specific local storage helpers.
- Map and discovery features depend on correct Google Maps and Supabase configuration.
- Database migrations are the source of truth for schema, RLS policies, and SQL functions.
