# CVB-5 — Diferir el endgame cuando se gana por pegar en mesa

**Fecha:** 2026-06-01
**Issue:** CVB-5 (Huly, workspace Personal / proyecto CaidaVZLABot)
**Archivos:** `class/Game.js`, `services/gameSerialize.js`, `lang/{es,en,pt}.js`, tests vitest

## Problema

Cuando se reparte un deck nuevo, el dealer puede hacer puntos al "pegar en
mesa" (la secuencia 4→3→2→1 o 1→2→3→4 que se reparte al inicio). Si esos
puntos cruzan el umbral de la partida (`config.points`), el código actual
termina el juego inmediatamente:

```js
// class/Game.js, handing_out_cards() ~L331
if (points > 0) {
  if (this.increase_points(this.users.length - 1, points))
    return this.kill(this.users.length - 1);   // ← endgame prematuro
  added += resp.sync_cards + points + "\n";
}
```

Esto es incorrecto cuando `mata_mesa === "on"`: el primer jugador de la mano
(índice 0, que juega justo después del reparto) puede dar caída a la última
carta repartida (`syncCard`) y, vía `mata_mesa`, anular exactamente esos
puntos de mesa (L431-435). El `kill` se dispara antes de darle esa chance.

### Por qué los puntos de mesa siempre son reversibles

Antes de pegar en mesa, el puntaje del dealer está necesariamente por debajo
del umbral (si no, el juego habría terminado en la mano anterior). `mata_mesa`
resta `min(puntaje_actual, puntos_de_mesa) = puntos_de_mesa`, devolviendo al
dealer exactamente a su puntaje pre-mesa (< umbral). Por lo tanto la caída del
primer jugador siempre puede revertir una victoria que provenga solo de los
puntos de mesa.

## Decisiones de diseño (acordadas)

1. **mata_mesa OFF:** no se difiere. Los puntos no son reversibles, así que el
   juego termina inmediato como hoy. Solo se difiere cuando `mata_mesa === "on"`.
2. **Doble victoria simultánea:** si el jugador 0 no mata la mesa pero gana con
   su propia jugada en ese mismo turno, gana el **dealer** (su victoria ocurrió
   primero, al repartir; el jugador 0 tuvo su chance de matarla y no lo hizo).
3. **Mensaje:** se muestra un aviso explicativo cuando se difiere.

## Diseño

### Componente 1 — Diferir (`handing_out_cards`, ~L331)

Reemplazar el `kill` inmediato por lógica condicional:

- Sumar los puntos al dealer (son suyos hasta que se anulen) — sin cambio.
- Si cruza el umbral:
  - **Reversible** (`mata_mesa === "on"` && `_dealerSyncCandidate` existe):
    setear `this._pendingMesaWinSlot = this.scoringSlot(this.users.length - 1)`
    y agregar el mensaje explicativo a `added`. El juego continúa; jugador 0
    queda en turno (`this.player` ya es 0 tras el reparto).
  - **No reversible:** `return this.kill(this.users.length - 1)` como hoy.
- Si no cruza el umbral: flujo actual (`sync_cards`).

### Componente 2 — Resolver (`play_card`, justo antes del win-check ~L471)

Insertar, **antes** del loop general de win-check (L471-475), un bloque que
resuelve la victoria diferida con prioridad:

```js
if (this._pendingMesaWinSlot != null) {
  const slot = this._pendingMesaWinSlot;
  this._pendingMesaWinSlot = null;
  if (this.points[slot] >= this.config.points) {
    // sobrevivió la mesa → el dealer ganó primero, prioridad sobre el jugador 0
    return this.kill(slot, response + this.renderShortStatus());
  }
  // mata_mesa lo bajó del umbral → cae al win-check normal (el jugador 0
  // puede ganar con sus propios puntos de caída)
}
```

`kill(slot, ...)` sigue la misma convención que el loop existente (`kill(i)`
donde `i` es índice del array `points`, válido también en parejas porque el
slot mapea a un miembro del equipo del dealer).

**Por qué funciona el timing:** `mata_mesa` corre en `play_card` (L431-435)
*antes* de este bloque. Tras la jugada del jugador 0:
- Si dio caída a la `syncCard` → `mata_mesa` redujo `points[slot]` por debajo
  del umbral → el bloque cae al win-check normal (jugador 0 puede ganar con sus
  puntos de caída).
- Si no la dio → `points[slot]` sigue ≥ umbral → `kill(slot)` → gana el dealer
  con prioridad sobre cualquier victoria del jugador 0 en ese turno.

La ventana de diferimiento es exactamente una jugada: `_dealerSyncCandidate` se
consume tras la primera jugada (L437/L467), y este bloque corre en todo
`play_card`, así que `_pendingMesaWinSlot` siempre se resuelve en la jugada
siguiente al reparto.

### Componente 3 — Persistencia (`services/gameSerialize.js`)

`_dealerSyncCandidate` ya se persiste; el nuevo flag debe seguir el mismo
patrón o un restart en la ventana de diferimiento lo pierde.

- Constructor (`class/Game.js`, junto a `_dealerSyncCandidate = null`):
  `this._pendingMesaWinSlot = null;`
- `serialize()`: `pending_mesa_win_slot: game._pendingMesaWinSlot ?? null`
- `deserialize()`: `game._pendingMesaWinSlot = data.pending_mesa_win_slot ?? null`

Es un número (slot) o null — serialización trivial, sin transformación de Card.

### Componente 4 — Mensaje (`lang/{es,en,pt}.js`)

Nueva string `mesa_win_pending` con placeholders `{dealer}`, `{pts}`, `{p0}`:

- **es:** `"⏳ {dealer} llegó a {pts} pegando en mesa. {p0} puede dar caída a la última carta para matarlos, o la partida termina.\n"`
- **en:** `"⏳ {dealer} reached {pts} sticking cards on the table. {p0} can caída the last card to kill them, or the game ends.\n"`
- **pt:** `"⏳ {dealer} chegou a {pts} colando na mesa. {p0} pode dar caída na última carta para matá-los, ou a partida termina.\n"`

Interpolación en `handing_out_cards` al setear el diferimiento. `{dealer}` y
`{p0}` se resuelven por separado desde `this.users[this.users.length - 1]` y
`this.users[0]` respectivamente, aplicando la misma regla de mención que
`playerName()` (`@username` si tiene, si no `first_name`) — pero NO se llama
`playerName()` directo, porque esa función devuelve el jugador actual (índice
0) y acá hace falta también el dealer. Extraer la regla a un helper
`mentionName(user)` reutilizable (refactor menor de `playerName()` para que
delegue en él) mantiene una sola fuente de verdad.

## Testing (vitest)

1. Dealer pega en mesa y cruza umbral, `mata_mesa` on, jugador 0 da caída →
   no gana nadie, juego sigue, `points` del dealer revertidos por debajo del
   umbral, `_pendingMesaWinSlot` queda null.
2. Mismo escenario, jugador 0 **no** da caída → gana el dealer (`kill` con el
   slot del dealer).
3. Jugador 0 no mata la mesa pero gana con su propia jugada (estaba a 1 punto,
   hace mesa limpia) → gana el **dealer** (prioridad cronológica), no el
   jugador 0.
4. `mata_mesa` off + cruza umbral al pegar en mesa → gana el dealer inmediato,
   `_pendingMesaWinSlot` nunca se setea.
5. serialize→deserialize con `_pendingMesaWinSlot` seteado → el flag sobrevive
   el round-trip.

## Fuera de alcance

- Estrategia del CPU pro para priorizar la caída de mata_mesa (el fix funciona
  igual: si el CPU no la da, el win-check resuelve la victoria del dealer).
- Cualquier cambio al path de `bad_sync_cards` (L337) — es otra mecánica.
