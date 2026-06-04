# SP1 — Motor realtime + mesa jugable en el WebApp (seats uniformes)

**Fecha:** 2026-06-04
**Huly:** CVB-6 (padre) · sub-tareas CVB-7…CVB-17 · workspace Personal / proyecto CaidaVZLABot
**Estado:** T0 (este spec = el contrato). Aprobado el contrato; los tracks construyen contra esto.

## Contexto

Hoy Caída se juega en grupos de Telegram vía mensajes/stickers del bot; el WebApp
(`dashboard-ui/`, React+Vite+TS, deployado en `server.codeaver.com/caidavzlabot`,
auth por `initData` HMAC) solo muestra stats/admin. Queremos Caída jugable como
"juego de verdad" (mesa interactiva, no chat) **dentro del WebApp**.

El motor de reglas (`class/Game.js`) ya existe, está testeado, y es **agnóstico del
transporte**: solo opera sobre `User`s en `game.users[]`. Hoy el transporte es
Telegram (mensajes + timers `setTimeout` en `index.js`). SP1 agrega un transporte
WebSocket paralelo, **sin tocar** `services/game.js` ni los handlers del bot.

## Visión (decisiones tomadas en brainstorming)

- **Sesiones propias del WebApp** con lobby in-app (opción A). Independiente de los
  grupos de Telegram. La play-en-grupo queda como mundo paralelo intacto.
- **WebSocket desde el día 1** (socket.io), no HTTP-luego-swap.
- **Seats uniformes**: un seat es humano (atado a un socket) o CPU (server lo
  auto-juega). El motor ya los trata igual — no hay "modo CPU". Un CPU es un
  jugador que controla el server.
- **SP1 incluye** humanos + CPUs con un join mínimo (código / deep link). Lobby
  pulido (públicos, matchmaking, presencia, reconexión) es SP2.
- Checkpoint interno: validar todo **solo-vs-CPU** antes de humanos.

## Acciones del jugador (verificadas contra el motor)

Solo hay **3** acciones de juego:
1. `play(cardIndex)` — jugar una carta de la mano. La **caída es consecuencia
   automática** de jugar la carta que pega (mismo `position` que `last_card_played`);
   NO es una acción aparte.
2. `sing()` — declarar el canto (cuando tenés 3 cartas y un canto con valor).
3. `startBy(1|4)` — dirección al repartir un deck nuevo. El motor lo expone como
   una "mano" especial: `get_player_cards` devuelve `["Start_By"]` cuando toca
   elegir dirección. En el protocolo se modela como un `play` sobre esa mano especial.

Acciones de lobby: create / join / addCpu / removeCpu / start / leave.

## Contrato

### Modelo de sesión + seats

```
GameSession {
  code            // p.ej. "CAIDA-7K2P"
  status          // "lobby" | "playing" | "finished"
  game            // instancia de class/Game.js (sin modificar)
  seats[0..3]     // hasta 4
  hostUserId      // quién puede start / addCpu / removeCpu
}

Seat {
  index           // 0..3
  kind            // "human" | "cpu"
  userId?         // si humano
  name
  difficulty?     // "easy"|"medium"|"pro", si cpu
  connected       // socket vivo (humano); siempre true para cpu
}
```

Store en memoria `Map<code, GameSession>` (`sessionStore.js`), **separado** del
`games[chatId]` de Telegram. El orden de los seats define el orden de juego que el
motor ya usa (`game.users[]`).

**Host y desconexión (mínimo SP1):**
- `hostUserId` = quien creó la sesión (seat 0).
- Host se va en **lobby** → la sesión se cierra (`session:ended` con motivo, sin
  ganador). Lobby pulido / migración de host es SP2.
- Humano se desconecta **mid-game** → su seat queda `connected:false`. En su turno,
  el server auto-skipea por timeout (misma lógica de `autoSkipTurn`, T4). Si
  reconecta con el mismo `user.id`, retoma su seat y recibe el `session:state`
  actual. Reconexión robusta es SP2.

### Protocolo WS (socket.io)

**Cliente → Server**
```
session:create    { config? }          → sienta al emisor en seat 0; responde { code }
session:join      { code }             → ocupa el próximo seat libre
session:addCpu    { difficulty }       → (host, lobby) llena un seat con CPU
session:removeCpu { seatIndex }        → (host, lobby)
session:start     {}                   → (host, ≥2 seats) reparte el primer deck
action:play       { cardIndex }        → jugar carta; o elegir 1/4 si la mano es startBy
action:sing       {}                   → declarar tu canto
session:leave     {}
```

**Payload de `action:play`:** en estado normal `cardIndex` es el índice de la carta
en `you.hand`. En estado `startBy` (la mano es `{type:"startBy"}`), `cardIndex`
lleva el **valor de dirección literal `1` o `4`** (NO un índice). `GameSession.play`
lo lee como `dir = arg === 4 ? 4 : 1`.

**Server → Cliente**
```
session:state     { state }            → snapshot por-viewer; en join y tras CADA cambio
session:error     { code, message }    → code legible (p.ej. "not_your_turn", "session_full")
session:ended     { winner, standings }
```

Modelo: **full-state broadcast por-viewer en cada cambio**. El estado es chico →
sin deltas, robusto, fácil de razonar. El campo `lastEvent` permite animar/sonar
(caída / mesa limpia / canto / mata_mesa) sin un stream de eventos aparte.

Auth: el handshake de socket.io verifica `initData` HMAC (mismo `verifyInitData` de
`services/dashboardAuth.js`). El `user.id` del initData identifica al jugador en sus
seats. Sin initData válido → conexión rechazada.

### Estado por-viewer (`serializeForClient(session, viewerUserId)`)

```jsonc
{
  "code": "CAIDA-7K2P",
  "status": "lobby" | "playing" | "finished",
  "config": { "points": 24, "game_mode": 1, "mata_mesa": "on", "type": "individual", ... },
  "seats": [
    { "index": 0, "kind": "human", "name": "Andrés", "connected": true,
      "cardCount": 3, "points": 12, "took": 0, "sang": null, "color": "🔴" }
    // took = cartas tomadas en la mano ACTUAL (se resetea cada mano, como
    // game.took[]). color solo en modo individual; "" en parejas.
    // ... SIN las cartas de los rivales: solo cardCount
  ],
  "table": [ {"value":4,"type":"Oro"}, null, ... ],   // 10 slots por posición
  "lastCardPlayed": {"value":7,"type":"Copa"} | null,
  "turnSeat": 2,          // índice del seat en turno
  "dealerSeat": 3,
  "lastHand": false,
  "you": {
    "seat": 0,
    "hand": [ {"value":3,"type":"Espada"}, ... ] | {"type":"startBy"},  // TUS cartas (full)
    "canSing": {"name":"Patrulla","value":30} | null
  },
  "lastEvent": { "kind": "caida"|"mesa_limpia"|"canto"|"mata_mesa"|"play"|null,
                 "seat": 1, "card": {"value":7,"type":"Copa"} } | null,
  "winner": { "seat": 2, "standings": [...] }   // solo si status === "finished"
}
```

**Frontera de información oculta:** de los rivales solo va `cardCount`. La mano real
(`you.hand`) solo se envía al dueño de ese socket. `serializeForClient` se llama una
vez por viewer al broadcastear.

### Mapa de cartas

El motor usa `Card` con `value`/`type`/`position`/`number`. Al cliente va la forma
mínima `{value, type}` (+ `position` si la UI lo necesita para el layout de mesa).
Reusar el helper de serialización de cartas que ya existe en `gameSerialize.js`
(`cardToNumber`/`numberToCard`) como referencia; el cliente recibe `{value,type}`.

## Estructura de archivos

**Backend** (container del bot, Node):
```
services/realtime/
  protocol.js           constantes de nombres de evento (contrato compartido)
  serializeForClient.js proyección pura Game→JSON por-viewer (T1)
  GameSession.js        envuelve Game: seats, lifecycle, turn loop, CPU step (T2, T4)
  sessionStore.js       Map<code,GameSession> (T2)
  wsServer.js           socket.io attach + auth initData + ruteo (T3, T5)
```
Montado desde `config/server.js` sobre el mismo `http.Server` de Express (socket.io
comparte el puerto 3000 → loopback :3010 → nginx). Solo se activa si
`dashboard_base_url` está seteado (igual que el dashboard).

**Frontend** (`dashboard-ui/`, React):
```
src/game/
  protocol.ts   espeja services/realtime/protocol.js (nombres de evento)
  types.ts      espeja el estado por-viewer (TS)
  ws.ts         socket client tipado — transporte (T6)
  store.ts      estado React desde session:state (T7)
  screens/Lobby.tsx     crear/unir/addCpu/start (T5 cliente)
  screens/Table.tsx     la mesa (T8)
  components/Mesa.tsx Hand.tsx Opponent.tsx CantoPicker.tsx EndGame.tsx (T8, T9)
```
Nueva ruta/tab en el WebApp ("🎮 Jugar") que monta el flujo Lobby→Table. No
reemplaza las tabs actuales (Mi cuenta / Top / etc.).

## Descomposición y orden de ejecución

Grafo: `T0 → T1,T2 → (T3→T4→T5 ‖ T6→T7→T8→T9) → T10`

| Fase | Tareas | Paralelo | Gate |
|---|---|---|---|
| 0 | T0 (este spec) | — | Aprobado |
| 1 | T1 (serializeForClient) · T2 (GameSession + store) | T1 ‖ T2 | tests verdes |
| 2 | Backend T3→T4→T5 ‖ Frontend T6→T7→T8→T9 | 2 tracks | review por track |
| 3 | T10 (integración + solo-vs-CPU e2e) | — | demo jugable |

Backend y frontend de Fase 2 construyen contra `protocol.js`/`types.ts` (mismos
nombres de evento) y contra el shape de estado de este spec. Esa es la única
sincronización entre tracks.

## Testing

- **T1**: `serializeForClient` — pura, unit tests (oculta manos rivales, expone la
  propia, mapea table/turn/points, marca `canSing`, winner en finished).
- **T2**: `GameSession` — lifecycle (crear/join/addCpu/start), seats uniformes,
  delegación correcta al motor, store keyed por code.
- **T3/T4/T5**: integración WS (auth rechaza initData inválido, ruteo de acciones,
  turn loop avanza CPUs, broadcast por-viewer).
- **T10**: e2e solo-vs-CPU — crear sesión con 1 humano + 3 CPU, jugar un deck
  completo hasta una victoria, validando estados intermedios.

## Fuera de alcance (SP2+)

- Lobby pulido: lista de partidas públicas, matchmaking, ready states.
- Presencia / reconexión robusta (SP1 maneja desconexión básica: el seat queda
  `connected:false`, el server puede auto-skipear su turno por timeout).
- Persistencia de sesiones WebApp en DB (SP1 las mantiene solo en memoria; si el
  proceso reinicia, la partida WebApp se pierde — aceptable para SP1).
- Sonido/animaciones finas (SP1 deja los hooks vía `lastEvent`).
- Chat in-game.
