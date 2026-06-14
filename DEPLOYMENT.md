# Production Deployment

This app is now scoped to dashboard, families, members, payments, payment transactions, announcements, audit logs, settings, users, and tours. Rooms, transport, pickup seats, food planning, emergency contacts, and reports are not exposed in the UI or API.

## Requirements

- Docker and Docker Compose
- A domain name pointing to the server
- A strong database password and Django secret key

## First Deploy

1. Copy the production environment template:

   ```bash
   cp .env.production.example .env
   ```

2. Edit `.env` and replace every placeholder value. Use your real domain in `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS`.

3. Build and start the production stack:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env up -d --build
   ```

4. Create the first admin account:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env exec backend python manage.py createsuperuser
   ```

5. Optional demo data for a fresh test environment:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env exec backend python manage.py seed_demo
   ```

## Updating

Pull or copy the new code, then rebuild and restart:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

The backend container runs migrations and collects static files on startup.

## TLS

Put a TLS reverse proxy such as Caddy, Traefik, Nginx Proxy Manager, or a cloud load balancer in front of this stack. After HTTPS is active, set this in `.env`:

```bash
SECURE_SSL_REDIRECT=1
```

Keep `CSRF_TRUSTED_ORIGINS` and `CORS_ALLOWED_ORIGINS` using `https://` URLs.

## Backups

Back up the `postgres_data` and `media_data` Docker volumes regularly. `media_data` stores uploaded receipts. A simple manual database dump is:

```bash
docker compose -f docker-compose.prod.yml --env-file .env exec db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
```

Store backups outside the server as well.

## Health Checks

- Frontend: `http://your-domain/`
- API: `http://your-domain/api/dashboard/`
- Admin: `http://your-domain/admin/`

If the frontend loads but API calls fail, check `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, and `VITE_API_URL`.
