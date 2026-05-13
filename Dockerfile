FROM node:22-alpine

WORKDIR /app

# wget is needed for HEALTHCHECK below; sharp needs libvips runtime libs already bundled in alpine wheels.
RUN apk add --no-cache wget

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["npm", "start"]
