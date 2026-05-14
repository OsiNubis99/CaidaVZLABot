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

# Slice the Wikimedia Spanish deck PNG into 40 individual card images +
# the reverse, so they're baked into the image and ready to upload to
# Telegram at first run.
RUN node scripts/slice_deck.js

# Fetch the 10 canto emoji SVGs from Twemoji (jdecked maintained mirror)
# and compose them into per-canto 512x512 sticker PNGs.
RUN mkdir -p /app/public/twemoji && \
    for hex in 1f0cf 1f417 1f693 1f441 1f4cb 1f985 1f5d2 1f3e0 1f3db 1f3ba; do \
      wget -q -O /app/public/twemoji/$hex.svg \
        "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/$hex.svg" || exit 1; \
    done && \
    node scripts/generate_canto_stickers.js

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["npm", "start"]
