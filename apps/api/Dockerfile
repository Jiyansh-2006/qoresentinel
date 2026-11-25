FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json tsconfig.json ./
COPY packages/shared ./packages/shared
COPY packages/crypto ./packages/crypto
COPY apps/api ./apps/api

RUN npm install -w @qoresentinel/shared
RUN npm run build -w @qoresentinel/shared
RUN npm install -w @qoresentinel/crypto
RUN npm run build -w @qoresentinel/crypto
RUN npm install -w @qoresentinel/api
RUN npm run build -w @qoresentinel/api

EXPOSE 10000
CMD ["node", "apps/api/dist/index.js"]
