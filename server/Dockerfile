FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Generate Prisma client inside the image
RUN node node_modules/prisma/build/index.js generate

# Build TypeScript -> dist/
RUN npm run build

EXPOSE 3001
CMD ["node", "dist/index.js"]
