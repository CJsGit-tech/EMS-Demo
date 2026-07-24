FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_AGENTCREW_API_URL=http://localhost:8004/api/v1
ENV VITE_AGENTCREW_API_URL=${VITE_AGENTCREW_API_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK CMD wget --spider --quiet http://127.0.0.1/ || exit 1
