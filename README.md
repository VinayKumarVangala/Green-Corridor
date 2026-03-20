# JEEVAN-SETU (Green Corridor) 🚑

JEEVAN-SETU is an integrated emergency response ecosystem designed to minimize response times for ambulances through AI-driven coordination between citizens, ambulances, hospitals, and traffic police.

## Features

- **Public Route**: Citizen emergency requests and tracking.
- **Ambulance Module**: Navigation and assignment management.
- **Hospital Module**: Advance notification and dashboard.
- **Traffic Module**: Junction clearance alerts.
- **AI Brain**: Dynamic rerouting and stakeholder coordination.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database/Auth**: Supabase
- **Maps**: Leaflet (OpenStreetMap)
- **State Management**: Zustand
- **Real-time**: Supabase Realtime / Socket.io

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Copy the environment template:
   ```bash
   cp .env.local.example .env.local
   ```
4. Fill in your Supabase credentials in `.env.local`.

### Supabase Setup

1. Create a new Supabase project.
2. Run the initial migration found in `supabase/migrations/20260315000000_initial_schema.sql` in the SQL Editor.

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

- `/app`: App Router logic.
  - `/(public)`: Public routes.
  - `/(private)`: Protected role-based routes.
- `/components`: UI and feature components.
- `/supabase`: Migrations and schema.
- `/lib`, `/hooks`, `/types`: Support utilities.


## Documentation

- [/docs/api/README.md](docs/api/README.md)
- [/docs/user/citizen.md](docs/user/citizen.md)
- [/docs/user/ambulance.md](docs/user/ambulance.md)
- [/docs/user/hospital.md](docs/user/hospital.md)
- [/docs/user/traffic.md](docs/user/traffic.md)
- [/docs/developer/setup.md](docs/developer/setup.md)
- [/docs/developer/architecture.md](docs/developer/architecture.md)
- [/docs/developer/deployment.md](docs/developer/deployment.md)
- [/docs/developer/contributing.md](docs/developer/contributing.md)
- [/docs/hackathon/README.md](docs/hackathon/README.md)
