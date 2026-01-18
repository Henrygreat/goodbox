FROM node:20-alpine

WORKDIR /app

# Prisma needs openssl
RUN apk add --no-cache openssl1.1-compat ca-certificates

COPY package*.json ./

# IMPORTANT: install dev deps so TypeScript build works
ENV NODE_ENV=development
RUN npm ci --include=dev

COPY . .

RUN npx prisma generate

# Compile TS -> dist
RUN npm run build

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
