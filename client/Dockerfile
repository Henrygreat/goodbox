FROM node:20-slim AS build
WORKDIR /app

COPY package*.json ./

# Force dev deps even if NODE_ENV=production is set by the platform
ENV RUN NODE_ENV=development npm install

RUN npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN node ./node_modules/typescript/bin/tsc && node ./node_modules/vite/bin/vite.js build

FROM nginx:slim
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
