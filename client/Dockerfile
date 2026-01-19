# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite build arg (optional)
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build


# ---- Run stage ----
FROM nginx:alpine

# Copy the built frontend (Vite outputs to dist/)
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config from the client folder
COPY nginx.coolify.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
