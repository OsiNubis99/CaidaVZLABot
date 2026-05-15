# Admin dashboard

Web admin panel para CaidaVZLABot. Live data sobre Postgres, mutaciones reales, auth via magic-link Telegram. Vive al lado del bot — mismo proceso Node + Express.

## Estado actual (V1)

- **Tabs**: Grupos / Usuarios
- **Por tab**: tabla con búsqueda (server-side, debounced 250ms), sort (server-side), paginación (server-side, 25 rows/pagina).
- **Acciones grupo**: toggle público, toggle baneado, extender pago (N meses), renombrar, eliminar.
- **Acciones usuario**: toggle baneado.
- **Auth**: comando `/dashboard_login` en el bot → DM con magic link → cookie HttpOnly Secure SameSite=Strict válida 12h.

Lo que `/admin` en Telegram sigue ofreciendo: acciones rápidas in-chat (banear un grupo desde el chat sin abrir el browser). Las dos surfaces conviven.

## Arquitectura

```
Telegram                    Browser
   │                           │
   │ /dashboard_login          │ click magic link
   │                           ▼
   │                    GET /auth?token=…
   │                    │   (verify HS256 + admin whitelist)
   │                    │   set HttpOnly cookie dash_session (12h)
   │                    │   redirect → /<DASHBOARD_PATH>/
   ▼                    ▼
nginx ── proxy_pass ── ▶ Express :3000
                          │
                          ├─ /<DASHBOARD_PATH>/auth        (magic exchange — public)
                          ├─ /<DASHBOARD_PATH>/login.html  (placeholder — public)
                          ├─ /<DASHBOARD_PATH>/api/*       (REST — auth required)
                          └─ /<DASHBOARD_PATH>/*           (static SPA — auth required)
                                                  │
                                                  └─ Postgres (Pool)
```

Path prefix configurable vía `DASHBOARD_PATH`. nginx pasa el path tal cual — no hay rewrite. Si lo cambiás, también cambiá `DASHBOARD_BASE_URL` para que el magic link apunte bien.

## Archivos

```
config/server.js                  monta el router del dashboard si está enabled
services/dashboardAuth.js         JWT magic + session, middleware requireSession
services/dashboardApi.js          Express Router: /auth, /api/*, static SPA
public/dashboard/index.html       SPA shell
public/dashboard/app.js           vanilla JS — fetch + tabs + tablas + modales
public/dashboard/styles.css       dark theme
public/dashboard/login.html       página plana para usuarios sin sesión
nginx-caidavzlabot.conf           snippet para pegar en el server block existente
```

## Endpoints

| método | path                                  | body                | descripción                     |
|--------|---------------------------------------|---------------------|---------------------------------|
| GET    | /auth?token=…                         |                     | exchange magic → cookie         |
| POST   | /api/logout                           |                     | clear cookie                    |
| GET    | /api/me                               |                     | `{admin_id}`                    |
| GET    | /api/groups?page&pageSize&sort&q      |                     | paginado                        |
| GET    | /api/groups/:id                       |                     | row raw                         |
| POST   | /api/groups/:id/public                | `{value: bool}`     |                                 |
| POST   | /api/groups/:id/banned                | `{value: bool}`     |                                 |
| POST   | /api/groups/:id/paid                  | `{months: int}`     | 1-120                           |
| POST   | /api/groups/:id/rename                | `{name: string}`    | trim, max 200                   |
| DELETE | /api/groups/:id                       |                     |                                 |
| GET    | /api/users?page&pageSize&sort&q       |                     | paginado                        |
| GET    | /api/users/:id                        |                     | row raw                         |
| POST   | /api/users/:id/banned                 | `{value: bool}`     |                                 |

Sort grupos: `name | active | public`. Sort usuarios: `name | wins | banned`.

## Deploy

1. **Bot side (.env del bot en el servidor):**
   ```
   DASHBOARD_JWT_SECRET=<openssl rand -hex 32>
   DASHBOARD_BASE_URL=https://server.codeaver.com/caidavzlabot
   DASHBOARD_PATH=/caidavzlabot
   ```
2. **Instalar deps + restart bot:**
   ```sh
   yarn install   # o npm install (jsonwebtoken + cookie-parser)
   pm2 restart caidavzlabot   # o lo que uses
   ```
3. **nginx**: pegá `nginx-caidavzlabot.conf` adentro del `server { … }` que ya sirve `server.codeaver.com`, después:
   ```sh
   sudo nginx -t && sudo systemctl reload nginx
   ```
4. **Login**: DM `/dashboard_login` al bot. Te DM-ea el link. Tocalo → estás dentro.

## Roadmap (V2)

- Vista de `game_events` por grupo (timeline + replay).
- Stats agregadas con gráficos (Chart.js): trivilín por jugador, win rate de CPUs por dificultad, distribución de cantos.
- Inspector de decisiones CPU (gated por `DEBUG_CPU_DECISIONS`).
- CSV export.
- Para esa fase la skill `/build-dashboard` calza perfecto — pre-aggregate SQL → embed → chart.

## Notas de seguridad

- Single admin pool: `ADMIN_USER_IDS` decide quién puede pedir magic links.
- El JWT secret nunca sale del server.
- Cookie scoped al path del dashboard — no se envía a `/`, `/health`, `/stats`, etc.
- `Secure=true` obliga HTTPS. Para probar localmente sin TLS, comentar `secure: true` en `dashboardAuth.setSessionCookie`.
- Rate limit `/dashboard_login`: max 3 / 30s por admin.
- Magic TTL 5 min, session TTL 12h. No hay refresh — al expirar, `/dashboard_login` de nuevo.
