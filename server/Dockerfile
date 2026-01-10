FROM node:20-alpine
WORKDIR /app

# Ensure devDependencies are available for TypeScript build
ENV NODE_ENV=development

COPY package*.json ./
RUN npm ci

COPY . .

# Generate Prisma client
RUN node node_modules/prisma/build/index.js generate

# Compile TypeScript -> dist/
RUN node node_modules/typescript/bin/tsc --pretty false

EXPOSE 3001
CMD ["node", "dist/index.js"]
