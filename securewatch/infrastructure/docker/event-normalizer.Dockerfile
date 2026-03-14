FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/types ./packages/types
COPY services/event-normalizer ./services/event-normalizer

RUN npm install --workspace=@securewatch/types --workspace=@securewatch/event-normalizer

RUN npm run build --workspace=@securewatch/types
RUN npm run build --workspace=@securewatch/event-normalizer

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/services/event-normalizer/dist ./dist
COPY --from=builder /app/services/event-normalizer/package.json ./
COPY --from=builder /app/node_modules ./node_modules

RUN addgroup -S securewatch && adduser -S securewatch -G securewatch
USER securewatch

CMD ["node", "dist/index.js"]
