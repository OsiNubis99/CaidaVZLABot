# CaidaVZLABot — Project Context

Telegram bot for the Venezuelan card game *Caída*. Forked from
`OsiNubis99/CaidaVZLABot` (2020). Rebuilt for production deploy on a
private server through ~12 work sessions in May 2026. Read this file
before touching the repo — it captures non-obvious decisions and the
exact state of the world.

## Stack

- **Node 22** (alpine) inside Docker. The Dockerfile slices the
  Wikimedia Spanish baraja during build so all 40 card PNGs are baked
  into the image.
- **Postgres 15** (alpine) as a sibling container, **port not exposed
  to host** (only via the compose network).
- **prodrigestivill/postgres-backup-local** sidecar for daily backups
  (14d/4w/3m retention, dedicated volume).
- `node-telegram-bot-api` 0.66 (bumped from 0.50 in round 12 — closes
  the 11 Dependabot warnings against transitive deps in 0.50, also
  drops the `bluebird cancellation deprecated` and `punycode`
  warnings).
- `express` for `/health` + `/stats`.
- `sharp` for slicing the deck and rendering the table.
- `pino` for structured JSON logs.
- `vitest` for unit tests (currently 58 tests across 9 files).

## Server / deploy

- SSH: `ssh -p 2228 andres@server.codeaver.com`
- Repo on server: `/home/andres/Repos/Bots/CaidaVZLABot` **(moved from
  `/home/andres/Repos/ifreturns/Bots/CaidaVZLABot` in commit-day-1)**
- Docker project name: `caidavzlabot` (derived from dir name). When
  moving the repo, keep the dir name `CaidaVZLABot` so volumes stay
  attached.
- Volumes: `caidavzlabot_caida-pgdata`, `caidavzlabot_caida-backups`.
- `.env` on server has permissions 600 and contains the bot token,
  DB credentials, `ADMIN_USER_IDS`, `LOG_LEVEL`, `STATS_TOKEN`.
- Bot uses **polling** (no public domain required). The Express
  server on port 3000 is internal-only.

## Deploy flow

1. Local: edit, commit, `git push origin develop`.
2. Server: `cd /home/andres/Repos/Bots/CaidaVZLABot && git pull origin develop`.
3. Server: `docker compose up -d --build bot` to rebuild only the bot
   container. (Use `docker compose up -d --build` to also rebuild
   postgres + backup, only needed when compose itself changes.)
4. Verify: `docker ps`, `docker logs caida-bot --tail 20`,
   `docker exec caida-bot wget -qO- http://127.0.0.1:3000/health`.

User has asked NOT to commit/push automatically — always confirm in
chat first (see `~/.claude/CLAUDE.md`).

## Tests

Run on the server in a one-off node container (avoids local node 16
vs the 22 the deps require):

```
docker run --rm -v $(pwd):/work -w /work -e NODE_ENV=test node:22-alpine \
  sh -c 'npm install --no-audit --no-fund --no-progress > /dev/null 2>&1 && npm test'
```

The `NODE_ENV=test` flag stops `config/db.js` from `process.exit(1)`
when it can't reach Postgres during tests.

CI: `.github/workflows/ci.yml` runs lint + tests + docker build on
push to main/develop.

## File map (top-level)

- `index.js` — entry point. Wires every `bot.on*` handler, holds the
  per-command rate-limit table, TURBO `skipTimers`, DM-notify
  helper, and the routing for callback queries (`a:*` admin UI,
  `c:*` config UI, the older game `set_*`/start/back/type/how_config
  callbacks).
- `config/`
  - `bot.js` — `node-telegram-bot-api` instance + `/start`, `/help`,
    `/id`, `/saluda`, `/version`. Polling mode.
  - `db.js` — pg `Client` + ready promise + idempotent migrations
    runner.
  - `env.js` — flat object of env vars (pgssl, token, admin_ids,
    log_level, stats_token).
  - `logger.js` — pino instance.
  - `server.js` — Express. Routes: `/`, `/health`, `/stats`,
    `POST /bot<TOKEN>` (webhook stub, unused with polling).
- `class/`
  - `Game.js` — in-memory game state and pure render logic.
    Important: `_lang()` resolves `getLang(this.config.locale)` so
    every `_renderHeader` / `_renderTeams*` / `_renderReducedStatus`
    / `_renderFinalScore` / `_renderFinalStandings` use localised
    strings. `INDIVIDUAL_COLORS` is a module-level constant for
    4-player free-for-all markers.
  - `User.js` — `print(started, lang)` returns a single line.
  - `Card.js` — derives `value`, `type`, `position`, `points` from a
    seed number (0..39).
  - `Sings.js` — canto detection from 3 sorted cards + config values.
  - `Config.js` — game config validation/state. `caida_continua` is
    implemented (`Game.handing_out_cards` resets `last_card_played`
    between manos when `caida_continua !== "on"`). `mata_mesa` is
    still a settable boolean but a no-op in `Game.play_card`.
  - `UserDTO.js`, `GroupDTO.js`, `RequestDTO.js` — DTOs wrapping
    Telegram chat/user/message. (Were `Factory_*.js` until round 12.)
- `database/`
  - `index.js` — exports `UserController` + `GroupController`.
  - `user.js` — `add`, `list`, `set_stats`, `set_sing` (column-name
    whitelisted), `ban_unban`, `top`, `setNotifyOnTurn`,
    `getNotifyOnTurn`.
  - `group.js` — `add`, `paid` (parametrised interval, **not**
    concatenated), `setPublic`, `rename`, `getOneById` (only valid
    groups), `getOneByIdRaw` (any), `update` (full config),
    `listPublic`, `list`, `remove`.
  - `migrations.js` — idempotent ALTER/CREATE statements. Runs on
    every startup after `db.ready`. Currently **9 statements**.
- `services/`
  - `game.js` — orchestrates Game instances per chat. Owns the
    `games[]` and `users[]` maps in module scope, populated by
    `persistence.loadAll()` after `db.ready`. Wraps each mutation
    with `persistOrRemove`, `attachMesaPhoto`, `attachNextTurn`,
    `events.record`. Exposes `peek`, `refreshConfig`, `autoSkipTurn`,
    `pendingTimerArmList`, `loadedPromise`.
  - `gameSerialize.js` — pure `serialize` / `deserialize` for Game.
    Cards are reduced to seed numbers; `Sings` to its data fields;
    `Start_By` sentinel preserved.
  - `persistence.js` — `save`, `remove`, `loadAll` to/from
    `public.game_state` (JSONB). Imports from `gameSerialize.js`.
  - `cards.js` — sticker file_id cache. `bootstrap(bot, chatId,
    {force})` uploads 40 cards as stickers (resized to fit
    Telegram's "longest side = 512" rule) and stores file_ids.
  - `cantos.js` — emoji per canto name (`icon`, `withIcon`).
  - `mesa.js` — `render(table)` returns a PNG Buffer composing the
    10 mesa slots on green felt.
  - `events.js` — typed event log (`record`, `lastGameEvents`,
    `pruneOlderThan`, `renderTranscript`). 30-day retention via a
    daily `setInterval`.
  - `adminUI.js` — BotFather-style admin menu (`a:*` callbacks).
    Plain text only (no MarkdownV2 — that's a known footgun, see
    commit `608b96b`). `pendingRenames` Map for the rename flow.
  - `configUI.js` — BotFather-style per-group config (`c:*`
    callbacks). `applyChange(chatId, mutator, {allowMidGame})`
    persists + refreshes in-memory game. When `allowMidGame` is
    false and a deck is in play, the mutation is rejected and the
    callback shows a popup alert.
  - `leaderboard.js` — `/top` renderer.
  - `rateLimit.js` — sliding-window per (userId, command) bucket.
    Index uses `COMMAND_LIMITS` table to drive limits per command.
  - `stats.js` + `statsView.js` — `/stats` dashboard data fetcher
    (Promise.allSettled so missing tables degrade gracefully) +
    dark-themed inline-CSS HTML.
- `lang/`
  - `es.js`, `en.js`, `pt.js` — all share the same key set
    (parity enforced by `tests/i18n.test.js`).
  - `index.js` — `getLang(groupOrLocale)` resolves a table, falls
    back to `es` for unknown locales.
  - `game_modes_es.js` — preset configs ("Clásico" + "The Grupish").
- `templates/`
  - `message.js` — `reply`, `inLine_keyboard`, `edit_keyboard`,
    `keyboard` builders that wrap Telegram message+options pairs.
  - `keyboard.js` — `group_settings` (Cómo configurar + Listo),
    `change_game_mode_and_back`, `list_game_modes_and_run`,
    `make_a_choice`, `back` (single Volver button).
- `public/cards/` — `_source_baraja_espanola_completa.png` + 40
  sliced PNGs + `back.png` (after Dockerfile slicing step).
- `scripts/`
  - `slice_deck.js` — slices the source PNG. Called during
    `docker build`.
  - `debug_grid.js` — overlays gridlines on the source PNG. Kept
    as a future debugging helper.
- `tests/` — 9 vitest files. 58 tests total.
- `.github/workflows/ci.yml` — CI runner.

## DB schema (5 tables, 9 migrations)

```
public.user            id_user PK + game stats + is_banned + notify_on_turn
public.group           id_group PK + game-rule config + visual_cards/visual_table
                       + turn_timeout_seconds + locale + public + paid_up_to + ...
public.cards           (value, type) PK + file_id (Telegram sticker file_id)
                       + uploaded_at
public.game_state      id_group PK + state (jsonb) + updated_at
public.game_events     id (bigserial) PK + id_group + event_type + payload (jsonb)
                       + created_at  (+ idx_game_events_group_time index)
```

Migrations list is the source of truth in `database/migrations.js`.

## Environment variables

Required: `TELEGRAM_TOKEN`, `POSTGRESQL_URL`, `PGSSL`,
`ADMIN_USER_IDS`. Optional: `LOG_LEVEL` (default info),
`STATS_TOKEN` (route is 503 when empty), `PORT` (default 3000).

`ADMIN_USER_IDS` is comma-separated Telegram user ids. Currently
only `114083702` (the user / project owner).

## Commands

User-visible (set via `setMyCommands`):
unirse, iniciar, inicia_ya, estado, reiniciar, configurar, help,
list_groups, stats, top, notify, historial.

Hidden / regex-only:
- `/id`, `/saluda`, `/version`
- `/admin` — list registered groups with action buttons. Admin-only.
- `/addgroup` — auto-register the current group. Admin-only,
  groups-only.
- `/addg-<chatId>-<name>` — legacy form, requires the id (no leading
  minus) and a name in the same command. Admin-only.
- `/paid-<chatId>-<times>` — extend paid_up_to by N months.
  Admin-only.
- `/lock`, `/unlock` — reply-to-message ban/unban. Admin-only.
- `/listUsers`, `/stats` (user-facing stats), `/historial`,
  `/cancelar` (cancels a pending /admin rename), `/bootstrap_cards`
  (admin DM only — uploads the 40 cards as stickers and caches
  file_ids). Accepts `/bootstrap_cards force` to wipe and re-upload.
- `/message <text>` — broadcast to every group in the DB. Admin-only.

Callback patterns:
- `a:*` — admin UI (`a:l`, `a:g:<id>`, `a:tp:<id>`, `a:p:<id>:<m>`,
  `a:rn:<id>`, `a:dq:<id>`, `a:dc:<id>`).
- `c:*` — config UI (`c:m`, `c:s:<section>`, `c:e:<key>`,
  `c:adj:<key>:<delta>`, `c:set:<key>:<val>`, `c:tog:<key>`, `c:close`).
- `set_<N>` — game-mode picker (legacy F2 callback).
- `how_config`, `back`, `type`, `start`, `close` — legacy callbacks
  driven by `templates/keyboard.js`.

## Visual cards system

- Cards are sent as **stickers**, not photos. Photos were too big on
  mobile (filled the chat bubble width). Stickers display at a
  consistent ~150 px wherever they go.
- `services/cards.js bootstrap` uploads each card via
  `bot.sendSticker` after resizing the source PNG to fit inside
  512×512 (Telegram's hard requirement for sticker uploads).
- File_ids live in `public.cards`. **An admin must run
  `/bootstrap_cards` in DM with the bot once** to populate them.
  Until then, all inline card results fall back to text articles.
- `visual_cards` toggle on the group: when on, the inline picker
  uses `cached_sticker`; when off, it falls back to text articles.
  The picker and the in-chat message are inseparable in Telegram's
  inline mode, so the toggle controls both at once.
- `visual_table` toggle: when on, `services/game.js attachMesaPhoto`
  renders the mesa as a composed PNG and attaches it as
  `response.photo`. `services/mesa.js` composes 10 slots in a 2×5
  grid on green felt. The "Mesa: 1 2 [] 4 ..." text line is
  stripped from the caption when the photo is sent, but every other
  status line (Caidó!, Mesa Limpia!, Última carta, Turno, team
  blocks, Barajando, etc.) stays in the caption.

## TURBO mode (turn timeout)

- `turn_timeout_seconds` on the group (0 = off, max 600).
- `attachNextTurn` includes `turnTimeoutSeconds` in the response.
- `index.js scheduleSkip(response)` arms a `setTimeout` per chat
  after each in-chat update; the timer auto-plays the current
  player's first card via `game.autoSkipTurn`.
- Start_By state (the inline "Iniciar por 1/4" guess) is handled
  too: `autoSkipTurn` picks "Iniciar por 1" automatically when the
  guesser's sentinel is detected.
- On bot restart, `index.js` waits for `game.loadedPromise` and
  re-arms timers for every loaded game with `turn_timeout_seconds > 0`.

## Persistence

- After every Game mutation in `services/game.js`,
  `persistOrRemove(chatId, finished)` either UPSERTs the serialized
  game into `public.game_state` or DELETEs the row when finished is
  true.
- On startup, `db.ready.then(persistence.loadAll)` rehydrates the
  `games[]` and `users[]` maps.
- Cards/Sings are stored as primitive seeds (Card.number, Sings
  data fields) and rebuilt with their constructors on load.

## Game render layout

In-game `Game.print(false)` produces (Spanish, parejas):

```
✨ Última mano   (only if last_hand)
Mesa: 1 2 [] 4 5 [] [] [] [] []
🎴 Última carta: 11 de Copa
👉 Turno: Andrés

🔵 Equipo Azul · 20 pts · 2 tomadas
   • Andrés (@OsiNubis99) · 3 cartas · sin canto

🔴 Equipo Rojo · 22 pts · 0 tomadas
   • Mafeer Lourenço (@mafeerlourenco) · 3 cartas · sin canto
```

In visual_table mode, the `Mesa: ...` line is stripped from the
caption since the photo conveys it.

Individual mode uses `🔴🔵🟢🟡` (`INDIVIDUAL_COLORS` in `Game.js`)
per position instead of `1. 2. 3. 4.`.

End-of-deck shuffle response gets a reduced status header
("`🔵 20 pts | 🔴 22 pts`" or "`🔴 24 | 🔵 22 | 🟢 18 | 🟡 15`")
before the "Barajando..." text. The first shuffle (decks 0 → 1)
skips this since points are all 0.

Victory message ends with the final score:
- Parejas: `🏆 Ganó Andrés (@OsiNubis99) 24-19`
- Individual: `🏆 Ganó X (Andrés 24, Mafeer 22, P3 18, P4 15)`

Then a standings block: team labels + final points, with bulleted
names (no took, no card counts, no "sin canto").

## Operational gotchas

- **Don't push to `main`.** The whole project lives on `develop`.
  GitHub repo: `OsiNubis99/CaidaVZLABot`.
- **MarkdownV2 footgun**: any literal `.`, `(`, `)`, `!`, `-`
  inside a MarkdownV2 message must be escaped. We hit this with
  `/admin` (commit `608b96b`). Default to plain text or regular
  Markdown.
- **Don't change Game's instance field shape** without updating
  `services/gameSerialize.js`. Persistence only round-trips the
  fields enumerated there.
- **Don't pre-strip `Mesa:`** when rendering the textual mesa to
  groups that have `visual_table=off` — only strip when attaching
  the photo. `attachMesaPhoto` is responsible.
- The `public.cards` table needs to be re-bootstrapped (`force`) any
  time the source PNGs change.
- The 5th row of the source deck PNG has the back card on the left
  with black to the right; column 7 and 8 are the Spanish 8 and 9,
  intentionally skipped (Caída only uses values 1-7 and 10-12).

## Tech debt + pending features

### Tech debt
- `mata_mesa` is configurable + persisted but **NOT implemented** in
  `Game.play_card`. Caída-kills-mesa-clearing behavior would need to
  be wired through. Setting the toggle has no in-game effect yet.
- DB password is in `.env` plain (600 perms). Not in a secret
  manager. User said skip — local server, low risk.
- i18n migration is complete across `services/*.js`, `index.js`,
  `class/Game.js`, `class/User.js`. Each handler resolves the
  locale via `langOf` / `langForMsg` / `_lang()` that walks back to
  the in-memory `Game.config.locale`. Direct `lang/es` imports
  remain only in `class/Config.js` (for `is_not_ok` error strings)
  and `tests/Config.test.js` (pins canonical Spanish strings).

### Pending features
- **Modo torneo / brackets** — fresh design, not started.
- **Anti-cheat** (multiple-account detection) — not started.
- **Webhook mode** (polling → HTTPS webhook) — needs the user to
  provide a domain + cert. Not started.
- **Auto-bootstrap cards on startup** — would need a
  `CARD_CACHE_CHAT_ID` env pointing at a channel where the bot is
  admin, so the manual `/bootstrap_cards` step goes away.
- **TURBO re-arm on persistence reload** for the guesser in Start_By
  state — handled via `attachNextTurn`'s Start_By detection +
  `pendingTimerArmList`, but real-world testing on a deployed
  Start_By restart still pending.

### UX preferences captured
- The Grupish preset defaults to `type: "individual"` (todos vs todos),
  not parejas. Cantos still on by default.
- `/configurar` hides game-rule sections (Modo, Puntos & ×, Reglas,
  Cantos) when a deck is in play; only Visuales + Sistema show.
- Mid-game rule rejections show as a popup `answerCallbackQuery` with
  show_alert, never a silent no-op.
- Played-card photo in chat: **sticker, no caption**. The bot's
  next message conveys "Última carta: X de Y" so context isn't
  lost.
- Mesa photo: **strip the `Mesa: ...` text line from the caption,
  keep everything else** (Última carta, Turno, Caidó, Mesa Limpia,
  Barajando, team listing). User wants context, just not the
  redundant ASCII mesa.
- Start_By picker ("Iniciar por 1 / Iniciar por 4"): **plain text
  articles**, not card photos. Explicit preference.
- 4-player individual: position-keyed `🔴🔵🟢🟡` markers, not `1.
  2. 3. 4.`.
- Don't render "Vacío" placeholders for empty team slots —
  skip them entirely.
- End-of-deck reduced status ("`🔵 20 pts | 🔴 22 pts`") above the
  "Barajando..." text.
- Victory message includes the final score on the won line.

### Known acceptable quirks
- Per-position color markers swap when users rotate between decks.
  Matches the parejas Rojo/Azul alternation; intentional, since
  position-based.
- Mesa renderer doesn't highlight the last-played card visually.
  The text caption keeps the "Última carta" line so info isn't
  lost.

## Recent commits (most → least recent)

```
ff41e01 12c++: finish i18n migration (index.js + drop resp imports)
dfea3c3 12c+: i18n migration in services/admin.js
a12a9cf docs: update context.md for round 12
54ade75 chore: bump node-telegram-bot-api 0.50 -> 0.66
37c77f0 12d: emit CAIDA event from structural flag, not text match
ff107ed 12c: i18n callsite migration in services/game.js
c7b1cc8 12b: rename Factory_* DTOs (UserDTO, GroupDTO, RequestDTO)
0d45ae9 test: align tests with Grupish=individual default
d9c14d9 12a: implement caida_continua, expose game-rule toggles
64f78e6 fix: hide game-rule sections from /configurar mid-game
9c624bc docs: add docs/context.md
10896d4 revert: visual_cards gates the inline picker again
bd33ace feat: inline picker always shows card stickers when cached (reverted next)
1eddac8 feat: cache cards as stickers, not photos
be0a672 fix: victory standings drop mesa/turno header and took/cards/sang
b08f0dc feat: victory shows final score; individual gets 4 colors; reduced shuffle
5136d95 feat: cleaner Game.print layout
70d2eec fix: cards-as-photo without caption; Start_By picker back to text articles
b009bdb fix: strip only the 'Mesa: ...' line; keep Siguiente/Caidó/Barajando
bcb1583 fix: mesa photo with no duplicated text body
ed5ac60 fix: configUI silent toggle + start_by photo
eb4772a feat: /addgroup auto-registers the current chat
7a8f2eb 10: BotFather-style /configurar menu
608b96b fix /admin silent failure: drop MarkdownV2
b542600 fix: catch fire-and-forget DB updates inside Game
808d969 11e: i18n migration of in-game render strings
17444ca 9c: i18n infrastructure (es + en + pt)
395ef1b F5: persist in-flight games to public.game_state
e303fe5 9a + 9b: replay/historial events + TURBO turn-timeout auto-skip
460e5be 8f: refactor Game.js per the Plan agent's 4-step plan
be25495 8a-8e: bug sweep, /top leaderboard, DM-on-turn, rate limit, daily backups
1354dc9 F0+F1: stabilization batch (Node 22, env-based admins, pino, healthcheck, P0 fixes)
1c84695 feat: dockerize bot with dedicated postgres
```

## Skills / agents used

- `Plan` subagent designed: (1) the Game.js refactor in Round 2,
  (2) the `/stats` dashboard architecture in Round 4.
- `general-purpose` (code-reviewer role) approved each major round,
  flagged real bugs (e.g. the `+` vs `||` precedence in
  `"Puntos: " + this.points[i] || 0 + " Tomado: "...`, the missing
  scheduleSkip on `/inicia_ya`).
- `general-purpose` (QA role) ran the test suite + smoke checks
  against the server. Was blocked by sandbox policy on production
  reads in some rounds — the user-facing PM (Claude main thread)
  ran those manually.
