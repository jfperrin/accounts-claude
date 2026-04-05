# syntax=docker/dockerfile:1

# ── Build client ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS client-builder
WORKDIR /build
COPY client2/package.json client/yarn.lock client/.yarnrc ./
RUN --mount=type=cache,target=/root/.yarn \
    YARN_CACHE_FOLDER=/root/.yarn \
    yarn install --frozen-lockfile
COPY --link client2/ .
RUN yarn build

# ── Server ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
COPY server/package.json server/yarn.lock server/.yarnrc ./
RUN --mount=type=cache,target=/root/.yarn \
    YARN_CACHE_FOLDER=/root/.yarn \
    yarn install --frozen-lockfile --production
COPY --link server/ .
COPY --link --from=client-builder /build/dist ./public
EXPOSE 3001
CMD ["node", "index.js"]
