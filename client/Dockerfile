FROM node:20-slim AS build
WORKDIR /app

COPY package*.json ./

# Install dev deps for the build (overrides any injected NODE_ENV)
RUN NODE_ENV=development npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build without relying on executable shims
RUN node ./node_modules/typescript/bin/tsc && node ./node_modules/vite/bin/vite.js build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
