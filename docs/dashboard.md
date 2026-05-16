# Caída — Telegram Web App

Web app que abre dentro de Telegram desde el botón del menú del bot (📎 al lado del input). Live data sobre Postgres, mutaciones reales, auth nativa por `initData` firmado por Telegram.

## Vistas (5 tabs)

| Tab | Quién la ve | Qué muestra |
|---|---|---|
| 👤 Mi cuenta | Todos | KPIs (partidas, wins, win rate, caídas), tabla de cantos (vivas/total), toggle `notify_on_turn` |
| 🏆 Top | Todos | Leaderboard global, 10/25/50/100 |
| 🌐 Públicos | Todos | Grupos públicos con link de invite (best-effort) |
| 📦 Grupos | Solo admin | Search/sort/paginación + toggle público/banned, +N meses, rename, delete |
| 👥 Usuarios | Solo admin | Search/sort/paginación + toggle banned |

## Arquitectura

```
Telegram client                Express :3010 (container)
   │ tap menu button              │
   │ ───── opens WebApp ─────► loads /caidavzlabot/index.html
   │ + window.Telegram.WebApp.initData  (signed by Telegram with bot token)
   │
   │ ◄────── SPA loaded
   │ fetch /api/me  + header X-Telegram-Init-Data: <initData>
   │ ──────────────────────► dashboardAuth.requireAuth
   │                              │ verify HMAC-SHA256(initData) == hash
   │                              │ check auth_date freshness
   │                              │ derive role from ADMIN_USER_IDS
   │                              ▼
   │                          dashboardApi router
   │                              │
   │                              ▼
   │                          Postgres (Pool)
```

`DASHBOARD_BASE_URL` se pasa a `setChatMenuButton` al boot. `DASHBOARD_PATH` es donde Express monta el router. nginx proxy_pass del mismo path al `127.0.0.1:3010` del container.

## Endpoints

Header obligatorio en todo `/api/*`: `X-Telegram-Init-Data: <urlencoded initData>`.

### User tier (cualquier user de Telegram auth)

| Método | Path | Body | Descripción |
|---|---|---|---|
| GET | `/api/me` | | `{role, telegram:{id,first_name,...}, user:{...stats}}` |
| POST | `/api/me/notify` | `{value:bool}` | Toggle `notify_on_turn` propio |
| GET | `/api/leaderboard?limit` | | Top global, `limit` 1-100 |
| GET | `/api/groups/public` | | Lista de grupos públicos con `invite` |

### Admin tier (además, `id in ADMIN_USER_IDS`)

| Método | Path | Body | Notas |
|---|---|---|---|
| GET | `/api/groups?page&pageSize&sort&q` | | sort: `name|active|public` |
| GET | `/api/groups/:id` | | raw |
| POST | `/api/groups/:id/public` | `{value:bool}` | |
| POST | `/api/groups/:id/banned` | `{value:bool}` | |
| POST | `/api/groups/:id/paid` | `{months:int}` | 1-120 |
| POST | `/api/groups/:id/rename` | `{name:string}` | trim, max 200 |
| DELETE | `/api/groups/:id` | | |
| GET | `/api/users?page&pageSize&sort&q` | | sort: `name|wins|banned` |
| GET | `/api/users/:id` | | raw |
| POST | `/api/users/:id/banned` | `{value:bool}` | |

## Auth: detalle del algoritmo

Telegram firma el `initData` con un secret derivado del bot token. La verificación, por el reglamento oficial:

1. Parsear `initData` como query-string URL-encoded
2. Tomar todos los pares excepto `hash`, ordenarlos alfa por key
3. Construir `data_check_string` = `<k1>=<v1>\n<k2>=<v2>\n...`
4. `secret_key = HMAC-SHA256(key="WebAppData", message=BOT_TOKEN)`
5. `computed = HMAC-SHA256(key=secret_key, message=data_check_string)`
6. Si `computed === initData.hash` → válido. Comparación con `timingSafeEqual`.

Rechazamos además si `auth_date` está más viejo que 24h. Como no hay sesión persistente, cada request lleva el `initData` actual; la WebApp de Telegram lo refresca internamente.

## Archivos

```
services/dashboardAuth.js     verifyInitData(), requireAuth(), requireAdmin()
services/dashboardApi.js      Express Router con los endpoints listados
public/dashboard/index.html   SPA shell, carga telegram-web-app.js
public/dashboard/app.js       SPA: tabs, fetch wrapper, modales, theme
public/dashboard/styles.css   estilos (CSS vars overrideable por themeParams)
public/dashboard/login.html   placeholder para visitas fuera de Telegram
nginx-caidavzlabot.conf       snippet para pegar en server.codeaver.com
```

## Deploy

```sh
# Server .env:
DASHBOARD_BASE_URL=https://server.codeaver.com/caidavzlabot
DASHBOARD_PATH=/caidavzlabot

# Pull + rebuild + restart:
cd ~/Repos/Bots/CaidaVZLABot
git pull --ff-only origin develop
docker compose up -d --build bot

# Verificar:
curl -i http://127.0.0.1:3010/caidavzlabot/api/me  # → 401 (sin initData)
docker logs --tail 10 caida-bot                    # → "chat menu button set"
```

Una sola vez por bot: nginx config (sudo). Snippet en `nginx-caidavzlabot.conf`.

## Roadmap

- Stats agregadas con Chart.js: trivilín por jugador, CPU winrate por dificultad, distribución de cantos
- Inspector de `game_events` (replay/timeline)
- CSV export del leaderboard
- BiometricManager / HapticFeedback fine-tune
