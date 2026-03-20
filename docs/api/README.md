# API Documentation

This directory contains Green Corridor API reference materials for developers and testers.

## Contents
- `openapi.yaml`: OpenAPI 3.0 specification.
- `postman_collection.json`: Postman collection for quick API testing.

## Base URL
- Local: `http://localhost:3000/api`
- Production: set by deployment host (e.g., Vercel)

## Key API groups
- `/api/emergency`: citizen request lifecycle.
- `/api/ambulance`: driver state controls, location updates.
- `/api/hospital`: notifications, patient readiness.
- `/api/traffic`: junction clearance and status.
- `/api/ai`, `/api/ml`, `/api/routing`: backend AI/serving endpoints.
