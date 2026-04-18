FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
RUN npm ci --workspace=backend
COPY backend/ backend/
RUN npm run build -w backend

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/backend/package.json backend/
RUN npm ci --workspace=backend --omit=dev
COPY --from=builder /app/backend/dist backend/dist/
RUN mkdir -p uploads
EXPOSE 3000
CMD ["node", "backend/dist/index.js"]
