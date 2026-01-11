FROM node:20-alpine
WORKDIR /app

# Ensure devDependencies are available for TypeScript build
ENV NODE_ENV=development

# Install openssl for Prisma
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

# Generate Prisma client
RUN node node_modules/prisma/build/index.js generate

# Compile TypeScript -> dist/
RUN node node_modules/typescript/bin/tsc --pretty false

EXPOSE 3001
CMD ["node", "dist/index.js"]
