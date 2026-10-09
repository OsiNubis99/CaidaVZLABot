# Caída — Telegram Web App

Web app que abre dentro de Telegram desde el botón del menú del bot (📎 al lado del input). Live data sobre Postgres, mutaciones reales, auth nativa por `initData` firmado por Telegram.

## Vistas

| Tab | Quién la ve | Qué muestra |
|---|---|---|
| 🎮 Jugar | Todos | Partida online (WebApp). El host reordena asientos en el lobby (toca uno y luego otro: orden de juego + parejas 1-3 vs 2-4); el lobby y el final dicen si la mesa **cuenta para el ranking** y por qué no |
| 🃏 Mesa real | Todos | **Acompañante** para partidas con cartas reales: el anfitrión crea `MESA-XXXX`, invita, sienta a la gente como está en la mesa (2v2 por defecto) y anota con 5 botones (un jugador por borde + Mesa limpia al centro). **Solo el árbitro** ve el botón verde; los demás ven en el centro quién arbitra y el marcador en vivo. 👥 **Lista de la mesa** (árbitro, jugando, cola, mirando), **cola** para la próxima, **pasar el rol** de árbitro y **tomarlo** si el árbitro lleva 5 min desconectado. Stats **separadas** de la app |
| 👤 Mi cuenta | Todos | Switch **App / Mesa real** (el mismo del Top; la elección se recuerda). App: KPIs (partidas, ganados, win rate, caídas dadas/recibidas, ratio), cantos (vivas/total), **últimas partidas** (si contaron y por qué no). Mesa real: partidas, ganadas, win rate, caídas, mesas limpias, puntos, puntos extra (➕ Sumar puntos), arbitradas, cantos por tipo y últimas mesas. Preferencias: toggle `notify_on_turn` y **Mantener la pantalla encendida** (por dispositivo, activado por default, con línea de estado) |
| 🏆 Top | Todos | Leaderboard 10/25/50/100 con switch **App / Mesa real** (rankings separados). Orden **oficial: % de victorias con mínimo 10 partidas** (los de menos van abajo, sin número). Tocar una columna trae el Top N **por esa columna** (orden en el server); tocarla otra vez o "Volver al ranking oficial" restaura |
| 🌐 Públicos | Todos | Grupos públicos con link de invite (best-effort) |
| 📦 Grupos | Solo admin | Search/sort/paginación + toggle público/banned, +N meses, rename, delete |
| 👥 Usuarios | Solo admin | Search/sort/paginación + toggle banned |

**Ranked (“Ganados”)**: sin CPUs y con los 13 valores numéricos (puntos, mesa, multiplicadores, cantos) iguales a un modo de fábrica (Clásico o The Grupish). El tipo (2v2 / todos contra todos) y los toggles (mata canto/mesa, caída continua) no importan. Regla en `services/ranked.js` (pura, la usan el writer de stats y la WebApp).

**Acompañante**: namespace socket.io `/companion` (mismo server y auth `initData`), sesiones en memoria + `public.companion_session` (sobreviven un deploy; flush en SIGTERM, barrido de mesas sin actividad por 12 h). Resultados en `companion_game` + `companion_player` — **nunca** toca `public.user`. Deep link `t.me/<bot>?startapp=MESA-XXXX` abre la pestaña Mesa real.

**Pantalla encendida** (`dashboard-ui/src/lib/keepAwake.ts`): Telegram no tiene un método de Mini App para esto (hasta Bot API 10.1). Mientras la WebApp está abierta y visible se usa, en orden:
1. La Screen Wake Lock API (`navigator.wakeLock`), donde el cliente la permite (iOS 16.4+/18.4+, Telegram Web/Desktop). Se vuelve a pedir al volver a la app, porque se libera al ocultarla.
2. Si el cliente la rechaza (Android WebView: "disallowed by permissions policy"), un clip muted de 2,5 KB a pantalla completa, con opacidad 0 y sin capturar toques. Chromium solo mantiene la pantalla con un video ≥75 % visible y ≥20 % del viewport (`video_wake_lock.cc`), por eso no sirve el truco del video de 1 px. Se rebobina a mano en lugar de usar `loop` y es muted, así que no corta la música.

Hay que verificarlo en teléfonos reales: el estado aparece en Mi cuenta → Preferencias, y `<html data-keep-awake>` vale `wakelock|video|failed|off`.

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
| GET | `/api/me/games?limit` | | Últimas partidas terminadas (grupos + WebApp, 30 días de `game_events`): `{rows:[{at, source, place, won, ranked, reason, preset, points, mySlot, players}]}` |
| GET | `/api/leaderboard?limit&sort` | | Top global, `limit` 1-100. `sort` ∈ `win_rate` (oficial, default) `win finished beat_pro caida caido caida_ratio`; otro valor → oficial. Responde `{rows, limit, sort, minGames}` |
| GET | `/api/companion/me` | | Acompañante: `{stats:{played,won,caidas,mesas,points,manual,refereed,cantos}, recent:[...]}` (`manual` = ➕ Sumar puntos; `refereed` = mesas guardadas como árbitro) |
| GET | `/api/companion/leaderboard?limit&sort` | | Top del acompañante (solo jugadores con cuenta). `sort` ∈ `win_rate` (oficial) `won played caidas mesas points` |
| GET | `/api/groups/public` | | Lista de grupos públicos con `invite` |

### WebSocket (socket.io, mismo path `<prefix>/socket.io/`)

- `/` — partida online. Nuevo: `session:swapSeats {a,b}` (host, lobby). El estado trae `hostSeat`, `you.isHost` y `ranked:{ranked, reason, preset}`.
- `/companion` — acompañante. C2S `companion:create|join|resume|swap|guest|kick|sit|config|start|record|undo|confirm|close|discard|rematch|queueJoin|queueLeave|queueAdd|queueRemove|seatQueued|transfer|claim|leave`; S2C `companion:state|error|ended`. Solo el árbitro (host) muta (validado en el server); desconectarse nunca saca a nadie.
  - `create {config?, referee?}` — `referee: true` = el creador solo arbitra (sin puesto ni stats). `sit {position?}` lo sienta (sin posición → primer puesto libre).
  - `join {code, watch?}` — `watch: true` re-engancha sin sentarse (espectadores que reconectan). Si hay **cola**, el link de invitación no sienta a nadie (no se salta la cola): entra mirando.
  - `record {kind: caida|canto|mesa|puntos, seat, value?, canto?}` — `puntos` = puntos manuales 1–99 (mala echada, lo pegado en mesa, cartas al final de la baraja).
  - `rematch {mode: again|winners|lobby}` — todos otra vez (arranca ya) · siguen los ganadores (los perdedores van **al final de la cola** y la cola llena todos los puestos libres) · nueva partida desde el lobby.
  - Cola: `queueJoin {}` / `queueLeave {}` (quien mira pide la próxima / se sale) · `queueAdd {name}` (árbitro anota a alguien sin app) · `queueRemove {qid}` · `seatQueued {qid, position}` (árbitro, lobby). Una mesa viva por persona: no se sienta a nadie que esté jugando en otra.
  - Rol: `transfer {pid}` (árbitro → alguien de la mesa con app y conectado) · `claim {}` (cualquiera de la mesa con app, si el árbitro lleva `5 min` desconectado). El estado trae `hostOnline`, `queue[]`, `spectators[]`, `you.queued` y `you.claimInMs`; las personas van con `pid` opaco por mesa, **nunca** el id de Telegram.

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
