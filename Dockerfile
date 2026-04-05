# syntax=docker/dockerfile:1

# ── Build client ───────────────────────────────────────────────────────────────
FROM node:24-alpine AS client-builder
WORKDIR /build
COPY client2/package.json client2/yarn.lock client2/.yarnrc ./
RUN --mount=type=cache,target=/home/ubuntu/.yarn \
    YARN_CACHE_FOLDER=/home/ubuntu/.yarn \
    yarn install --frozen-lockfile
COPY --link client2/ .
RUN yarn build

# ── Server ─────────────────────────────────────────────────────────────────────
FROM node:24-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY server/package.json server/yarn.lock server/.yarnrc ./
RUN --mount=type=cache,target=/home/ubuntu/.yarn \
    YARN_CACHE_FOLDER=/home/ubuntu/.yarn \
    yarn install --frozen-lockfile --production
COPY --link server/ .
COPY --link --from=client-builder /build/dist ./public
EXPOSE 3001
CMD ["node", "index.js"]
