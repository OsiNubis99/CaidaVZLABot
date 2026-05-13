FROM node:22-alpine

WORKDIR /app

# wget for HEALTHCHECK; sharp's prebuilt binaries ship with libvips bundled for alpine.
RUN apk add --no-cache wget

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Slice the Wikimedia Spanish deck PNG into 40 individual card images +
# the reverse, so they're baked into the image and ready to upload to
# Telegram at first run.
RUN node scripts/slice_deck.js

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["npm", "start"]
