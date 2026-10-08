# Diseño: Acompañante (mesa real) + ranked por modo de fábrica + reordenar asientos

- Fecha: 2026-10-07
- Estado: aprobado en conversación ("si me cuadra, realiza el plan e implementa todo")
- Alcance: backend (engine stats, realtime WS, DB, API) + WebApp (`dashboard-ui/`)

## 1. Problemas / pedidos

1. **Ranked mal calculado.** Elegir *The Grupish* y cambiar a todos-contra-todos
   dejaba la partida como "custom" y no sumaba a *ganados*. Causa:
   `gameStats.isDefaultScoring` compara los 13 valores numéricos **solo** contra
   Clásico, y Grupish trae Chigüire=5. Regla pedida: *solo deja de contar si se
   cambian multiplicadores o puntos*; el tipo (2v2 / todos contra todos) y los
   toggles nunca cuentan como modificación.
2. **Ganador mal atribuido en el evento `game_finished`.** `services/game.js`
   usa `group.player` ("kill sets this.player to the winner") pero `Game.kill()`
   no lo setea: si alguien gana por canto/tomadas en la jugada de otro, el
   evento (y `/historial`) nombra al que jugó la carta. Las stats sí se
   acreditan bien. Mismo riesgo en `GameSession._buildWinner` (escanea slots).
3. **Reordenar asientos (WebApp).** Hoy los jugadores quedan en orden de unión.
   El host debe poder moverlos (orden de juego y parejas 1-3 vs 2-4). "Es algo
   realmente importante."
4. **Acompañante.** Para partidas con cartas reales: una persona (el anfitrión)
   crea la mesa, invita, los demás aceptan con su cuenta, se ordenan como están
   sentados y el anfitrión anota todo. Sin repartir cartas. Estadísticas
   **separadas** de la app. 2v2 (parejas) por defecto.

## 2. Ranked

- Una partida es *ranked* si **no hay bots** y sus 13 valores numéricos
  (`points, mesa, caida, ronda, chiguire, patrulla, vigia, registro, maguaro,
  registrico, casa_chica, casa_grande, trivilin`) coinciden con **algún modo de
  fábrica** (`lang/game_modes_es` con `game_mode > 0`: Clásico, The Grupish).
  Se ignoran `type`, `game_mode`, `mata_canto`, `mata_mesa`, `caida_continua`.
- `gameStats.rankedStatus({config, hasBots})` → `{ranked, reason, preset}` con
  `reason ∈ {null, "bots", "custom_scoring"}` y `preset` = nombre del modo que
  coincidió. `computeResult` incluye `reason`, `preset` y `slot` por entry.
- `Game.kill(player)` guarda `this._winnerSlot = player`. `services/game.js` y
  `GameSession._buildWinner` usan ese slot para nombrar al ganador.
- **Transparencia:**
  - Telegram: si la partida no cuenta, el mensaje de victoria agrega una línea
    con el motivo (es/en/pt).
  - WebApp: el estado trae `ranked` (badge en el lobby, aviso en el fin de
    partida). El formulario de mesa muestra en vivo si la config cuenta, y
    ofrece los presets Clásico / The Grupish.
  - Las partidas de la WebApp también registran `game_finished` (id = código de
    mesa). `GET /api/me/games` lista tus últimas partidas (30 días de
    retención) con resultado, marcador y si contaron / por qué no. "Mi cuenta"
    las muestra.

## 3. Reordenar asientos (partida WebApp)

- `GameSession.swapSeats(a, b)`: host + lobby. Intercambia dos asientos,
  reindexa y reordena `game.users` igual que los asientos. Los colores se
  quedan con cada jugador (`Game.join` reparte el primer color libre, así una
  salida del lobby no duplica colores).
- El host deja de ser "el asiento 0": el estado expone `hostSeat` y
  `you.isHost`; Lobby/EndGame dejan de asumir `seat === 0`.
- WS: `session:swapSeats {a, b}` (host).
- UI: toca un jugador y luego otro para intercambiarlos. En parejas se marcan
  los equipos (1 y 3 vs 2 y 4). Leyenda: el 1 sale primero, reparte el último.

## 4. Acompañante (mesa real)

### Modelo

- Sesión `MESA-XXXX`, en memoria **y persistida** en `public.companion_session`
  (JSONB): un deploy en plena mesa real no pierde el marcador.
- 4 posiciones fijas alrededor de la mesa: `0` abajo (el anfitrión por
  defecto), `1` derecha, `2` arriba, `3` izquierda. Cada posición está vacía o
  tiene `{userId|null, name, guest}`. Parejas = posiciones enfrentadas
  (0+2 vs 1+3), igual que el engine (`i % 2`).
- Modo efectivo: parejas solo con `type="parejas"` **y** 4 sentados; si no,
  individual. Default `type="parejas"`.
- Config: meta de puntos, tipo, valor de mesa, multiplicadores caída/ronda y
  valores de cantos (los toggles del engine no aplican).

### Flujo

- **Lobby (anfitrión):** invitar (deep link `t.me/<bot>?startapp=MESA-XXXX`),
  configurar, ordenar (toca un asiento y luego otro → se intercambian; vale con
  asientos vacíos), quitar a alguien, agregar *invitado sin cuenta* (solo nombre,
  sin stats), o levantarse ("solo anoto"). Empezar con ≥2 sentados.
- **Los demás:** aceptan el link → se sientan en el primer lugar libre; ven el
  marcador en vivo, sin poder tocar nada.
- **Tablero (5 botones):** un botón por jugador en cada borde + "Mesa limpia" en
  el centro.
  - Borde → hoja del jugador: **Caída** 1/2/3/4 (×mult. caída), **Canto**
    Ronda 1–4 (×mult. ronda) y los cantos con valor > 0, **Tomadas** +N y
    **Reparto** +N (steppers).
  - Centro → ¿quién limpió la mesa? → +valor de mesa.
  - ↶ Deshacer (último) e historial con ✕ por registro.
  - En parejas el número grande es el total del equipo (ambos compañeros
    muestran lo mismo); cada registro se atribuye a la persona (stats).
- **Fin:** al llegar a la meta aparece la confirmación "Ganó X, 24 a 19"
  → *Guardar* o *Deshacer (fue un error)*. Botón **Cerrar** en cualquier momento:
  elegir ganador (se guarda con el marcador actual) o cerrar y borrar sin
  guardar. Tras guardar: revancha (vuelve al lobby, mismos asientos) o cerrar.

### Estadísticas separadas

- Tablas propias `companion_game` + `companion_player`. **El módulo del
  acompañante nunca escribe `public.user`**, y las stats de la app nunca leen
  estas tablas.
- Por jugador con cuenta: partidas, ganadas, caídas, cantos (por tipo), mesas
  limpias, puntos aportados. Invitados sin cuenta no generan stats.
- `GET /api/companion/me` (stats + últimas mesas), `GET
  /api/companion/leaderboard`. UI: sección "Acompañante" en Mi cuenta y toggle
  App / Mesa real en Top.

### Transporte

- Namespace socket.io `/companion` sobre el mismo servidor y auth (`initData`).
- C2S: `companion:create|join|resume|swap|guest|kick|config|start|record|undo|
  confirm|close|discard|rematch|leave`. S2C: `companion:state|error|ended`.
- Desconectarse **no** saca a nadie (solo presencia). Barrido cada 30 min:
  mesas sin actividad por 12 h se eliminan.

## 5. Fuera de alcance

- Reordenar en partidas de grupos de Telegram (`/unirse`).
- Contar turnos/quién reparte en el acompañante (no se trackean jugadas).
- Reclamar un asiento de invitado después de empezar.
- Backfill de stats viejas (eventos de >30 días ya no existen).
