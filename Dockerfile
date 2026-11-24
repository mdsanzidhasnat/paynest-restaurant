# syntax=docker/dockerfile:1

# Multi-stage image: build the client and server with dev dependencies, then
# ship only production dependencies plus the compiled output.
FROM node:20.19.0-bookworm-slim AS build
WORKDIR /app

# bcrypt and better-sqlite3 may need a native build when no prebuilt binary
# matches the image, so keep the toolchain in the build stage only.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:20.19.0-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/pos.db
WORKDIR /app

RUN groupadd --gid 10001 paynest \
  && useradd --uid 10001 --gid paynest --create-home --shell /usr/sbin/nologin paynest \
  && mkdir -p /data \
  && chown -R paynest:paynest /data /app

COPY --from=build --chown=paynest:paynest /app/dist ./dist
COPY --from=build --chown=paynest:paynest /app/dist-server ./dist-server
COPY --from=build --chown=paynest:paynest /app/node_modules ./node_modules
COPY --chown=paynest:paynest package.json package-lock.json ./
COPY --chown=paynest:paynest docs/schema.sql ./docs/schema.sql

USER paynest
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/api/health').then(function (r) { process.exit(r.ok ? 0 : 1); }).catch(function () { process.exit(1); })"
CMD ["npm", "start"]
