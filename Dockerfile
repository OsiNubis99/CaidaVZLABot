# ─── Stage 1: build the React SPA ─────────────────────────────────────
# Vite + TS build that emits a hashed-asset bundle into /ui/dist.
# We then copy that into the runtime image under /app/public/dashboard,
# so Express serves it as static files at DASHBOARD_PATH.
FROM node:22-alpine AS ui-builder
WORKDIR /ui
COPY dashboard-ui/package.json dashboard-ui/package-lock.json* ./
RUN npm install
COPY dashboard-ui/ ./
RUN npm run build

# ─── Stage 2: bot runtime ─────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# wget for HEALTHCHECK; sharp's prebuilt binaries ship with libvips bundled
# for alpine. fontconfig + a font (DejaVu) are needed at canto-sticker
# build time — without them sharp silently skips SVG <text> glyphs, so
# the stickers come out without their names ("Patrulla", etc.).
RUN apk add --no-cache wget fontconfig ttf-dejavu

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Drop in the built SPA. This goes AFTER `COPY . .` so it wins over
# any stale public/dashboard committed in the repo (we keep that path
# gitignored, but defensive ordering doesn't hurt).
COPY --from=ui-builder /ui/dist /app/public/dashboard

# Slice the Wikimedia Spanish deck PNG into 40 individual card images +
# the reverse, so they're baked into the image and ready to use.
RUN node scripts/slice_deck.js

# Fetch the 10 canto emoji SVGs from Twemoji (jdecked maintained mirror)
# and compose them into per-canto 512x512 sticker PNGs. Used by the
# canto custom-emoji pack.
RUN mkdir -p /app/public/twemoji && \
    for hex in 1f0cf 1f9ab 1f693 1f441 1f4cb 1f985 1f5d2 1f3e0 1f3db 1f3ba; do \
      wget -q -O /app/public/twemoji/$hex.svg \
        "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/$hex.svg" || exit 1; \
    done && \
    node scripts/generate_canto_stickers.js

# Generate the 50 custom-emoji WEBPs (40 cards + 10 cantos) at 100x100,
# ready for /bootstrap_emojis to upload to Telegram's emoji pack API.
RUN node scripts/generate_emoji_pack.js

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["npm", "start"]
