# Claude — CaidaVZLABot

Telegram bot del juego de cartas Caída. Repo simple en GitHub (`OsiNubis99/CaidaVZLABot`), no usa el gitflow ifreturns — branch principal es `develop`, push directo permitido.

**Antes de cualquier cambio, leer `docs/context.md`** para arquitectura, decisiones técnicas y el dominio del juego.

Documentación específica adicional:
- `docs/context.md` — arquitectura completa, decisiones de juego, dominio
- `docs/dashboard.md` — web admin dashboard (auth, endpoints, deploy)
- `nginx-caidavzlabot.conf` — snippet nginx para producción

---

## Servidor de producción

**Host:** `server.codeaver.com` (Ubuntu)
**SSH:** `ssh -p 2228 andres@server.codeaver.com`
**Acceso:** clave ssh ya autorizada para `andres@miserver`. Grupos: `sudo docker lxd plugdev …`. Sudo **requiere password** (no passwordless) — pedirlo al usuario para cualquier paso que toque `/etc/`.

### Layout en el server

```
~/Repos/Bots/CaidaVZLABot/      repo deploy (mismo origin, branch develop)
   ├── .env                     vars de producción (NO commitear)
   ├── docker-compose.yml       define caida-postgres / caida-bot / caida-backup
   └── …
/etc/nginx/sites-enabled/
   ├── 00-http-redirect.conf    todo :80 → :443
   ├── 10-cockpit.conf          server.codeaver.com → cockpit + (acá montamos /caidavzlabot)
   ├── 20-api-dev.conf          apidev.codeaver.com → localhost:3000 (NestJS otro proyecto)
   └── 30-frontend-catchall.conf catch-all → :3001 frontend Next.js
/etc/letsencrypt/live/dev-wildcard/   cert wildcard *.codeaver.com (+ *.mundoprccs.com)
```

### Puertos en uso en el host

| Puerto | Servicio |
|--------|----------|
| 22     | SSH (no es :2228 — eso es el público; internamente :22) |
| 80/443 | nginx |
| 3000   | NestJS (apidev.codeaver.com) — proyecto ajeno |
| 3001   | Next.js (catch-all frontend) — proyecto ajeno |
| 3010   | **caida-bot** (publicado solo en `127.0.0.1:3010` → container :3000) |
| 5432   | postgres (loopback) |
| 9090   | cockpit |

### Stack del bot

Tres containers gestionados por docker-compose:

| Container | Imagen | Notas |
|---|---|---|
| `caida-postgres` | postgres:15-alpine | volumen `caida-pgdata` |
| `caida-bot` | local build de Dockerfile | publica `127.0.0.1:3010:3000` |
| `caida-backup` | prodrigestivill/postgres-backup-local:15 | pg_dump diario, 14d/4w/3m retention |

`docker` está en grupo del usuario `andres` — `docker compose …` corre sin sudo.

### Vars de entorno en producción

`.env` (en `~/Repos/Bots/CaidaVZLABot/`) tiene además de lo de `.env.example`:

```
DASHBOARD_JWT_SECRET=<32 bytes hex>
DASHBOARD_BASE_URL=https://server.codeaver.com/caidavzlabot
DASHBOARD_PATH=/caidavzlabot
```

`docker-compose.yml` forwardea esas tres vars al container.

---

## Workflow de deploy

```sh
# Local
git add … && git commit -m "…"
git push origin develop          # repo simple — push directo a develop OK

# Server (sin sudo, todo el ciclo)
ssh -p 2228 andres@server.codeaver.com
cd ~/Repos/Bots/CaidaVZLABot
git pull --ff-only origin develop
docker compose build bot
docker compose up -d bot
docker logs --tail 30 caida-bot   # verificar arranque
```

Cambios que SÍ requieren sudo (pedírselos al usuario):
- editar nginx (`/etc/nginx/sites-*`) → `sudo nginx -t && sudo systemctl reload nginx`
- abrir puertos en firewall
- crear/extender certs let's encrypt

### Logs

```sh
docker logs --tail 100 -f caida-bot           # bot
docker logs --tail 50 caida-postgres          # pg
docker logs --tail 50 caida-backup            # cron de backups
```

### DB access

```sh
docker exec -it caida-postgres psql -U "$DB_USER" -d "$DB_NAME"
# o desde el host (loopback):
psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME"
```

### Smoke test del dashboard (interno, sin pasar por nginx)

```sh
curl -i http://127.0.0.1:3010/caidavzlabot/login.html          # 200
curl -i http://127.0.0.1:3010/caidavzlabot/api/me              # 401
curl -i http://127.0.0.1:3010/caidavzlabot/                    # 302 a login.html
curl -i http://127.0.0.1:3010/health                            # {"status":"ok","db":"connected"}
```

---

## Convenciones de código

- Node 22 dentro del container (alpine base)
- pg con Pool, máximo 10 conexiones
- pino para logs (JSON estructurado en prod)
- Persistencia debounced 250ms + flush en SIGTERM
- CPU bots son objetos en memoria, id = `cpu_<chatId>_<slot>`, no tienen fila en `public.user`
- Reaper cron cada 30 min para games huérfanos > N min

### Lang files

Tres locales en `lang/{es,en,pt}.js` — mantenerlos sincronizados al agregar strings. Default es `es`.

### Admin surfaces

| Surface | Para qué |
|---|---|
| Telegram `/admin` | Acciones rápidas in-chat (banear grupo/user, +N meses, rename) |
| Web `/caidavzlabot` | Search + paginación + audits (cuando crece, queda acá) |

Ambos coexisten — no es un reemplazo, es complemento.

### Notas de seguridad

- `DASHBOARD_JWT_SECRET` no se commitea, vive solo en `.env` del server
- Cookie del dashboard: HttpOnly + Secure + SameSite=Strict, scoped al `DASHBOARD_PATH`
- Magic link TTL 5 min, sesión 12h, sin refresh — al expirar se vuelve a pedir `/dashboard_login`
- Bot container expone puerto SOLO en `127.0.0.1` — nada de público fuera de nginx
