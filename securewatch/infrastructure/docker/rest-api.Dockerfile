FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/types ./packages/types
COPY services/rest-api ./services/rest-api

RUN npm install --workspace=@securewatch/types --workspace=@securewatch/rest-api

RUN npm run build --workspace=@securewatch/types
RUN npm run build --workspace=@securewatch/rest-api

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/services/rest-api/dist ./dist
COPY --from=builder /app/services/rest-api/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

RUN addgroup -S securewatch && adduser -S securewatch -G securewatch
USER securewatch

CMD ["node", "dist/server.js"]
