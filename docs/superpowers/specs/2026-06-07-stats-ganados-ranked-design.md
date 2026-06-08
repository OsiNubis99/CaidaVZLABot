# Diseño: "ganados" ranked + win rate de bots + logro PRO

- Fecha: 2026-06-07
- Estado: aprobado
- Alcance: backend (engine + services + DB) y dashboard (Mi cuenta + Stats).

## Problema

Hoy cada jugador tiene `win` y `win_custom`. El registro (en `class/Game.js →
kill()`, fire-and-forget) decide `win` vs `win_custom` por `game_mode > 0`, y
`game_mode` se vuelve 0 con **cualquier** cambio de config (incluso un On/Off o
el tipo). Eso no gusta: se quiere un **solo** "ganados", y que solo cuente para
partidas "de verdad".

## Decisiones

- **Enfoque A (inline centralizado) + resguardos**, no cola event-sourced. El
  registro ya está desacoplado del juego (fire-and-forget) y toda la data está
  en memoria al terminar. Resguardos: (1) enriquecer el evento `GAME_FINISHED`
  para dejar abierta una re-derivación futura; (2) lógica de decisión en función
  pura testeada.
- **Reset:** `win = 0` para **todos** (humanos y bots) — el `win` histórico ya
  estaba sesgado por la regla vieja.
- **Logro PRO:** se muestra en **Mi cuenta** (badge) y **Stats** (gráfico). No
  se toca el `/stats` del chat.

## Conflicto resuelto

"Solo cuenta si NO hay bots" choca con medir win rate de bots (un bot siempre
está en su propia partida). Solución: la regla *ranked* aplica **solo a
humanos**; las filas de bot (`cpu_easy/medium/pro`) cuentan **todas** sus
partidas para el win rate.

## Schema (`public.user`)

- `win` → significa **"ganados" (ranked)**. Migración de **reset a 0** para todos.
- `win_custom` → **se deja de usar** (columna congelada; se podrá dropear luego).
- **Nueva** columna `beat_pro int DEFAULT 0` (migración `ADD COLUMN IF NOT EXISTS`).
- `finished` sin cambios (todas las partidas jugadas).

Migraciones (idempotentes, en `database/migrations.js`):
- `ALTER TABLE public.user ADD COLUMN IF NOT EXISTS beat_pro int DEFAULT 0`
- Reset: `UPDATE public.user SET win = 0` (one-shot; idempotente en el sentido de
  que re-correrla solo re-cero-ea, pero ver "Nota de reset").

**Nota de reset:** la sentencia de reset NO debe re-ejecutarse en cada boot (las
migraciones corren en cada arranque). Se implementa como una migración
**marcada/guardada** una sola vez — p.ej. una fila en una tabla `schema_meta`
(`key='win_reset_v1'`) que, si ya existe, salta el UPDATE. Alternativa simple:
correr el reset manualmente una vez en el deploy y NO ponerlo en migrations.
Decisión de implementación: hacerlo guardado para que el deploy sea
reproducible.

## Reglas

**`isDefaultScoring(config)`** — compara los 13 valores numéricos contra Clásico
(`lang/game_modes_es[1]`):
`points=24, mesa=4, caida=1, ronda=1, chiguire=0, patrulla=6, vigia=7,
registro=8, maguaro=9, registrico=10, casa_chica=11, casa_grande=12,
trivilin=24`. **Ignora** `mata_canto / mata_mesa / caida_continua` (On/Off),
`type` y `game_mode`.

**`recordResult(game, winnerSlot)`** — función de decisión pura:
- `hasBots = game.users.some(u => u.cpu_difficulty)`
- `ranked = !hasBots && isDefaultScoring(game.config)`
- por jugador `i` (slot `game.scoringSlot(i)`): `won = slot === winnerSlot`,
  `isBot = !!u.cpu_difficulty`
  - `finished += 1` siempre
  - `win += 1` si `isBot ? won : (ranked && won)`
  - `caida/caido` se acumulan como hoy
- **Logro PRO:** si `game.users.length === 2` y el roster es exactamente
  1 humano + 1 `cpu_pro` (`cpu_difficulty === 'pro'`) y ganó el humano →
  `beat_pro += 1` del humano.

## Dónde se computa

- **Se quita** el loop `set_stats` de `class/Game.js → kill()`. El engine deja de
  escribir a Postgres (queda DB-agnostic).
- **`services/stats.js`** nuevo: `recordResult(game, winnerSlot)` (decisión) que
  llama a métodos del `UserController` para aplicar. Fire-and-forget con
  `.catch` (como hoy), para no bloquear la respuesta.
- Se invoca en `services/game.js`, en el/los punto(s) donde se detecta
  `response.finished` y ya se graba `GAME_FINISHED` (`play_card`,
  `handing_out_cards`; `autoSkipTurn` delega en esos). Una sola invocación por
  fin de partida.
- **Resguardo #1:** en ese mismo punto se **enriquece el payload de
  `GAME_FINISHED`** con: roster `[{statsId, isBot, difficulty, won}]`, snapshot
  del config numérico, `winnerSlot`, `is1v1`. Sin consumidor hoy; habilita
  recompute/migración a B sin re-tocar el flujo.

## DB (métodos en `database/user.js`)

- Reemplazar/ajustar `set_stats` por algo tipo
  `recordGameStats(id_user, { won, caida, caido })`: `finished+1`,
  `win + (won?1:0)`, `caida+=`, `caido+=`. El `won` ya viene decidido por
  `stats.js` (incorpora ranked/bot). Se elimina la rama `win_custom`.
- `incrementBeatPro(id_user)`.
- `stats()` (tab admin): win rate de CPU pasa a `win / finished` (sin
  `win_custom`); nuevo dataset `beatPro` = top humanos por `beat_pro > 0`.
- `top()` / `listPaged()`: ordenar por `win` (quitar `win_custom` del ORDER BY).

## Consumidores a actualizar (quitar `win_custom`)

`database/user.js` (top, listPaged, stats), `services/leaderboard.js`,
`services/statsView.js`, `services/adminUI.js`, `services/admin.js` (`/stats`
deja de mostrar "Ganados Custom"). El índice `(win, win_custom)` se deja
(inocuo).

## Dashboard

- **Mi cuenta** (`MeTab`): badge "🏆 Le ganó al PRO ×N" cuando `beat_pro > 0`
  (el endpoint `/api/me` ya devuelve la fila del user; sumar `beat_pro` al
  `UserRow`).
- **Stats** (`StatsTab` + `/api/stats`): nuevo gráfico/lista "Le ganaron al PRO"
  (top humanos por `beat_pro`). El win rate de CPU usa `win/finished`.

## Tests

- `isDefaultScoring`: Clásico → true; cada tweak numérico (points 30, caida 2,
  trivilin 20, …) → false; On/Off (`mata_canto on`, `caida_continua on`) y
  `type=parejas` → siguen true.
- `recordResult` (mockeando el writer): humano gana ranked → win+1; humano gana
  con bot en mesa o scoring no-default → win+0, finished+1; bot gana → win+1
  (siempre); 1v1 humano vs cpu_pro y gana humano → beat_pro+1; 1v1 que gana el
  PRO → beat_pro+0; >2 jugadores con un PRO → beat_pro+0.

## Fuera de alcance

- Worker / cola event-sourced (enfoque B). El evento queda enriquecido para
  habilitarlo después, pero no se construye el procesador.
- Dropear físicamente la columna `win_custom`.
- Backfill de stats desde `game_events` (reset limpio en su lugar).
