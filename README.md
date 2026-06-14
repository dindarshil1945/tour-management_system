# Family Tour Management System

Production-ready family tour management app with public read access and authenticated operational editing.

## Stack

- Frontend: React 19, Vite, TypeScript, Tailwind CSS, shadcn-style components, React Router, Axios, TanStack Query, Recharts, Lucide Icons
- Backend: Django, Django REST Framework, Simple JWT, Django Filters
- Database: PostgreSQL
- Deployment: Docker, Docker Compose, Nginx

## Quick Start

```bash
docker compose up --build
```

Services:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api
- Admin: http://localhost:8000/admin

Create an initial superuser:

```bash
docker compose exec backend python manage.py createsuperuser
```

Seed demo operating data:

```bash
docker compose exec backend python manage.py seed_demo
```

## Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the production Docker Compose workflow, environment variables, TLS notes, and backup commands.

## Access Model

Public users can read dashboard, families, members, payments, payment transactions, and announcements. Mutations require JWT authentication and either `SUPER_ADMIN` or `TOUR_COMMITTEE` role. Super admins can manage users and settings; committee users can perform operational tour management but cannot delete protected audit/payment/treasury history.

Treasury includes committee wallets, bank accounts, collections, expenses, transfers, receipt uploads, and a read-only financial ledger. Rooms, transport, pickup seats, food planning, and emergency contacts are not exposed as operational modules.

## Project Layout

```text
backend/   Django API, RBAC, domain models, import/export hooks
frontend/  React dashboard application
nginx/     Production reverse proxy config
docker-compose.yml
docker-compose.prod.yml
```
