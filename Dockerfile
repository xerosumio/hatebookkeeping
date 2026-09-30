# syntax=docker/dockerfile:1

# One image: the REST API and the MCP endpoint. When WEB_ORIGIN differs from
# PUBLIC_URL the process does not serve the SPA — GitHub Pages does.

FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/

# Coolify injects NODE_ENV=production at build time. That makes `npm ci` skip
# TypeScript and Vite. Force a full install here; the runtime stage still omits
# devDependencies.
RUN npm ci --include=dev


FROM deps AS build
WORKDIR /app

COPY tsconfig.base.json ./
COPY packages/ packages/

RUN npm run build --workspace @hbk/shared && npm run build --workspace @hbk/server


FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN npm ci --omit=dev --workspace @hbk/server --workspace @hbk/shared --include-workspace-root

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/server/dist packages/server/dist

RUN mkdir -p uploads && chown node:node uploads

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "packages/server/dist/index.js"]
