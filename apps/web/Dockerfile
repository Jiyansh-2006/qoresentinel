FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN npm install -w @qoresentinel/shared
RUN npm run build -w @qoresentinel/shared
RUN npm install -w @qoresentinel/web
ARG VITE_WALLETCONNECT_PROJECT_ID=""
ENV VITE_WALLETCONNECT_PROJECT_ID=${VITE_WALLETCONNECT_PROJECT_ID}
RUN npm run build -w @qoresentinel/web

FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
ENV API_UPSTREAM=api:4000
ENV PORT=80
ENV NGINX_ENVSUBST_FILTER=^(API_UPSTREAM|PORT)$
EXPOSE 10000
CMD ["nginx", "-g", "daemon off;"]
