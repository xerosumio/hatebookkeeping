FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY mcp-server/package.json mcp-server/
RUN npm ci --workspace=backend --workspace=mcp-server
COPY mcp-server/ mcp-server/
RUN npm run build -w mcp-server
COPY backend/ backend/
RUN npm run build -w backend

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/backend/package.json backend/
COPY --from=builder /app/mcp-server/package.json mcp-server/
RUN npm ci --workspace=backend --workspace=mcp-server --omit=dev
COPY --from=builder /app/mcp-server/dist mcp-server/dist/
COPY --from=builder /app/backend/dist backend/dist/
RUN mkdir -p uploads
EXPOSE 3000
CMD ["node", "backend/dist/index.js"]
