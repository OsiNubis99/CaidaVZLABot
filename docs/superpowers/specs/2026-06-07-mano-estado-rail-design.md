# Diseño: rail de estado + mano proporcional (WebApp)

- Fecha: 2026-06-07
- Estado: aprobado
- Alcance: solo frontend (`dashboard-ui/`). Sin backend ni cambios de lógica de juego.

## Problema

En la pantalla de juego, la mano del jugador (3 cartas) se renderiza centrada y
chica, con mucho espacio horizontal libre a los lados. El estado propio es una
barra de una sola línea (`you-bar`) con poco detalle. Resultado: las cartas
"apenas se ven" y el ancho está desaprovechado.

## Decisión

Opción A (elegida sobre B "abanico" y C "cartas a lo ancho"): **rail de estado
vertical a la izquierda + cartas a la derecha**, en una sola "fila de juego".
Aprovecha el ancho, deja el estado siempre visible y agranda las cartas
manteniendo su proporción.

## Diseño

Estructura del área inferior (`Table.tsx`, de arriba hacia abajo):

1. **Tira "Última"** (`.lastcard-strip`) — sin cambios.
2. **CantoPicker** — sin cambios; aparece solo cuando `you.canSing` (botón Cantar).
3. **Fila de juego** (`.play-row`) — caja con glow azul cuando es tu turno
   (`.play-row.is-turn`, reemplaza el glow de `you-bar`/`hand-active`):
   - **Rail** (`.you-rail`, ~66px fijo, columna): en este orden
     - 🔴 punto de color del jugador (`you.color`)
     - ⭐ `you.points` pts
     - 🂠 `you.took` (tomadas esta mano)
     - 🎵 `you.sang` (o 💀 tachado si `you.sangDead`; "—" si nada)
     - **No** se muestra: nombre (cada quien sabe el suyo), meta de puntos, ni
       pill de turno (el turno ya se ve arriba + glow de la fila).
   - **Mano** (`.hand-area`, ocupa el resto): las cartas (componente `Hand`)
     sin su propio panel (el panel es `.play-row`). Las cartas llenan el ancho
     con `flex: 1 1 0; min-width: 0` y `aspect-ratio: 208/319` → se achican
     solas si no caben (nunca desbordan) y nunca se distorsionan. `max-width`
     por carta para que no crezcan absurdo en pantallas anchas. Centradas.
   - **Hint** debajo de las cartas ("toca una carta" / "espera tu turno"),
     dependiente del turno, igual que hoy.
4. **Reparto inicial (`startBy`)**: la `.hand-area` muestra los botones
   **Por 1 / Por 4** en lugar de las cartas (igual comportamiento actual).

Estados de carta sin cambios: `dimmed` cuando no es tu turno, lift al tocar
(`@media (hover:hover)` + `:active`), highlight de caída.

Responsive / fullscreen:
- Rail ancho fijo (~66px); su tipografía puede achicarse en pantallas muy
  angostas. La fila nunca desborda gracias al flex-shrink de las cartas.
- `.play-row` con `max-width` y centrado para que en pantallas anchas
  (tablet/desktop) las cartas no se agranden de más.
- Los insets de fullscreen ya están resueltos a nivel `table-screen`.

## Componentes afectados

- `dashboard-ui/src/game/screens/Table.tsx`: reestructura `.table-bottom` →
  Última + CantoPicker + `.play-row` (rail + Hand). El rail se arma acá leyendo
  el asiento propio (`you`). Se retira el `you-bar` anterior.
- `dashboard-ui/src/game/components/Hand.tsx`: deja de envolver con su propio
  panel (`.hand` bg/borde); expone las cartas + hint para vivir dentro de
  `.hand-area`. El glow de turno pasa a `.play-row`.
- `dashboard-ui/src/game/game.css`: nuevos `.play-row`, `.you-rail`,
  `.hand-area`; ajustes en `.hand-cards`; baja/retira el estilo de `.you-bar`.

## Fuera de alcance

- Rediseño de la mesa (grid 2×5) y de la fila de oponentes.
- Backend, serialización y lógica de juego (los datos del rail ya vienen en el
  estado por-viewer: `points`, `took`, `sang`, `sangDead`, `color`).

## Verificación

- Sin tests de backend (cambio puramente visual).
- Chequeo manual en teléfono (Telegram, fullscreen):
  - Cartas claramente más grandes que antes, proporcionadas, sin desbordar la
    caja en pantallas angostas (iPhone SE ~320px) ni gigantes en anchas.
  - Rail muestra color, puntos, tomadas y canto; canto muerto tachado con 💀.
  - Glow azul de la fila solo en tu turno; hint correcto según el turno.
  - Reparto inicial muestra Por 1 / Por 4 en el lugar de las cartas.
