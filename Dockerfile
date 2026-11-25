# syntax=docker/dockerfile:1

# The API only. The web app is a static build served by GitHub Pages
# (.github/workflows/pages.yml); this image does not contain it.

FROM node:22-alpine AS deps
WORKDIR /app

# Every workspace's package.json, so `npm ci` sees the same workspaces the
# lockfile was written for.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
COPY packages/ui/package.json packages/ui/
COPY packages/ui-theme/package.json packages/ui-theme/

# Coolify injects NODE_ENV=production at build time, which would make `npm ci`
# skip TypeScript. Force a full install here; the runtime stage still leaves
# devDependencies out.
RUN npm ci --include=dev


FROM deps AS build
WORKDIR /app

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/server packages/server

RUN npm run build --workspace @hbk/shared && npm run build --workspace @hbk/server


FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
COPY packages/ui/package.json packages/ui/
COPY packages/ui-theme/package.json packages/ui-theme/
RUN npm ci --omit=dev --workspace @hbk/server --workspace @hbk/shared --include-workspace-root

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/server/dist packages/server/dist

# Uploaded files are kept in MongoDB, so the container needs no volume.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "packages/server/dist/index.js"]
