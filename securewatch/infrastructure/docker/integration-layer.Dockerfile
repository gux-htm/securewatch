FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root manifests
COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/types ./packages/types
COPY services/integration-layer ./services/integration-layer

RUN npm install --workspace=@securewatch/types --workspace=@securewatch/integration-layer

RUN npm run build --workspace=@securewatch/types
RUN npm run build --workspace=@securewatch/integration-layer

# ── Runtime image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/services/integration-layer/dist ./dist
COPY --from=builder /app/services/integration-layer/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

# Non-root user for security
RUN addgroup -S securewatch && adduser -S securewatch -G securewatch
USER securewatch

CMD ["node", "dist/server.js"]
