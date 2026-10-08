# Acompañante + ranked + reordenar asientos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ranked que acepta cualquier modo de fábrica (y explica por qué una partida no cuenta), reordenar asientos en la partida WebApp, y un "Acompañante" para anotar partidas con cartas reales con estadísticas separadas.

**Architecture:** Lógica de decisión pura y testeada (`services/gameStats.js`, `services/companion/scoring.js`), modelos sin I/O (`GameSession`, `CompanionSession`), I/O en los bordes (WS handlers, repositorio `database/companion.js`, `dashboardApi`). El acompañante vive en su propio namespace socket.io `/companion` y sus propias tablas.

**Tech Stack:** Node 22 CJS, socket.io 4, pg, vitest 2 (globals) · React 18 + Vite + TS + react-query en `dashboard-ui/`.

**Spec:** `docs/superpowers/specs/2026-10-07-acompanante-y-ranked-design.md`

## Global Constraints

- Strings visibles en es/en/pt (bot: `lang/{es,en,pt}.js` con paridad de keys; WebApp: `dashboard-ui/src/lib/i18n.dict.ts`).
- Español venezolano (tú), no voseo.
- El acompañante NUNCA escribe `public.user`; las stats de la app NUNCA leen `companion_*`.
- Migraciones idempotentes (`IF NOT EXISTS`) en `database/migrations.js`.
- Mutaciones solo del anfitrión (server-side), validadas en el handler.
- No commit/push sin confirmación del usuario.

## Review Focus

1. Mesa de 3 jugadores con `type=parejas` → debe jugarse/mostrarse individual (no colapsar slots).
2. Deshacer después de que alguien llegó a la meta → vuelve a "jugando" sin guardar nada.
3. Reconexión / cambio de pestaña del anfitrión a mitad de partida → nadie pierde su asiento, el marcador sigue.
4. Restart del server con una mesa del acompañante a mitad → se rehidrata desde DB.
5. Reordenar asientos y luego revancha → la revancha conserva el nuevo orden.

---

### Task 1: Ranked por modo de fábrica + ganador correcto

**Files:** Modify `services/gameStats.js`, `class/Game.js` (kill), `services/game.js` (2 sitios GAME_FINISHED), `services/realtime/GameSession.js` (_buildWinner). Test `tests/gameStats.test.js`, `tests/Game.test.js`, `tests/realtime/GameSession.test.js`.

**Interfaces — Produces:**
- `matchFactoryPreset(config) → {game_mode, name} | null`
- `isDefaultScoring(config) → boolean` (= hay preset de fábrica)
- `rankedStatus({config, hasBots}) → {ranked, reason: null|"bots"|"custom_scoring", preset: string|null}`
- `computeResult(game, slot)` agrega `reason`, `preset`, y `entries[i].slot`.
- `Game#_winnerSlot` (seteado en `kill`).

- [ ] Tests: Grupish+individual y Grupish+parejas → ranked; Grupish con chiguire 3 → `custom_scoring`; bots → `bots`; `kill(1)` con `player=0` → evento nombra al usuario del slot 1; `_buildWinner` usa `_winnerSlot`.
- [ ] Implementar y correr `npx vitest run tests/gameStats.test.js tests/Game.test.js tests/realtime`.

### Task 2: Ranked visible

**Files:** `lang/{es,en,pt}.js` (`ig_not_ranked_bots`, `ig_not_ranked_custom`), `class/Game.js` (línea al final del mensaje de victoria), `services/realtime/serializeForClient.js` (`state.ranked`), `services/realtime/wsServer.js` (`finishGame` registra `game_finished` con id = código), `services/dashboardApi.js` + `database/gameHistory.js` (`GET /api/me/games`).

**Produces:** `state.ranked: {ranked, reason, preset}`; `GET /api/me/games?limit` → `{rows: [{at, source:"group"|"webapp", place, won, ranked, reason, points:number[], winnerSlot, mySlot, players}]}`.

- [ ] Tests: victoria no-ranked incluye la línea; serialize expone `ranked` con bots → `reason:"bots"`; `projectGameRow` (puro) arma fila desde payload viejo (sin `reason`) y nuevo.

### Task 3: Reordenar asientos (partida WebApp)

**Files:** `services/realtime/GameSession.js` (`swapSeats`), `protocol.js` (`SESSION_SWAP: "session:swapSeats"`), `wsServer.js` (handler host), `serializeForClient.js` (`hostSeat`, `you.isHost`).

**Produces:** `swapSeats(a:number, b:number)`; estado `hostSeat:number|null`, `you.isHost:boolean`.

- [ ] Tests: swap reordena `game.users` y colores; refuse fuera de lobby / índices inválidos; host movido sigue siendo host; revancha conserva orden; WS: no-host recibe `not_host`.

### Task 4: Acompañante — reglas y sesión (puro)

**Files:** Create `services/companion/scoring.js`, `services/companion/CompanionSession.js`. Test `tests/companion/scoring.test.js`, `tests/companion/CompanionSession.test.js`.

**Produces:**
- `scoring.CANTO_KEYS`, `effectiveMode(config, seatedCount)`, `slotOf(position, mode)`, `opPoints(op, config) → number` (throws `bad_op`), `summarize({seats, ops, config}) → {mode, slots:[{slot, positions, total}], perSeat}`, `winningSlot(slots, target) → slot|null`, `sanitizeCompanionConfig(raw)`, `DEFAULT_CONFIG` (Clásico + `type:"parejas"`).
- `CompanionSession`: `constructor({code, host:{userId,name}, config})`, `join(user)`, `swap(a,b)`, `addGuest(name, position?)`, `kick(position)`, `sitHost(position)`, `setConfig(partial)`, `start()`, `record({kind, seat, value?, canto?})`, `undo(opId?)`, `confirmWin()`, `closeWithWinner(slot)`, `rematch()`, `leave(userId)`, `positionOf(userId)`, `buildRecord() → GameRecord`, `toJSON()`, `static fromJSON()`. Errores con `.code`.

- [ ] Tests de tabla: puntos de caída/ronda con multiplicadores, canto con valor 0 rechazado, parejas suma por equipo, 3 jugadores con type=parejas → individual, pendingWin al llegar a la meta y bloqueo de nuevos registros, undo limpia pendingWin, close manual, rematch, buildRecord por jugador (caídas, cantos, mesas, puntos, won).

### Task 5: Persistencia + stats del acompañante

**Files:** `database/migrations.js` (3 tablas + índice), Create `database/companion.js`, `services/companion/store.js`. Modify `index.js` (loadAll, reaper, flush en SIGTERM).

**Produces:** repo `saveSession(code, json)`, `deleteSession(code)`, `loadSessions()`, `insertGame(record) → id`, `userStats(userId)`, `recentGames(userId, limit)`, `leaderboard(limit)`; store `configure({repo, now})`, `create`, `get`, `findByUser`, `remove`, `persist`, `flush`, `loadAll`, `sweepExpired(maxIdleMs)`, `startReaper()`.

- [ ] Tests (repo fake): create/persist/flush, findByUser, sweepExpired, loadAll rehidrata.

### Task 6: WS `/companion`

**Files:** Create `services/companion/protocol.js`, `services/companion/companionWs.js`; Modify `config/server.js`. Test `tests/companion/companionWs.test.js`.

- [ ] Tests (socket.io real, repo fake): auth rechaza initData inválido; create→join→swap→start→record→state a ambos; no-anfitrión `not_host`; llegar a meta → confirm → `insertGame` llamado y estado finished; discard → `ended`.

### Task 7: API

**Files:** `services/dashboardApi.js`: `GET /api/companion/me`, `GET /api/companion/leaderboard`, `GET /api/me/games`.

### Task 8–10: WebApp

- Task 8: `configDefaults.ts` (GRUPISH, `matchPreset`), `CreateConfig` (presets + hint ranked + `variant="companion"`), `Lobby.tsx` (tap-to-swap, equipos, host por `hostSeat`), `EndGame` (aviso ranked, `isHost`), tipos + protocolo.
- Task 9: `src/companion/*` (store/ws con namespace, PreLobby, Lobby con mesa, Board 5 botones, hojas jugador/mesa/cierre/historial/confirmación, Finished), tab en `App.tsx` + deep link `MESA-`.
- Task 10: `MeTab` (últimas partidas + sección acompañante), `TopTab` (App / Mesa real), `api.ts`, i18n es/en/pt.

### Task 11: Verificación

- [ ] `npx vitest run` verde; `npx eslint` sin errores nuevos en archivos tocados; `cd dashboard-ui && npm run build` OK.
- [ ] Render del tablero con un mock en Chrome headless y revisar layout en 375px.
- [ ] Actualizar `docs/dashboard.md` y `docs/context.md`.
