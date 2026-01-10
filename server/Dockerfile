FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Generate Prisma client inside the image
RUN node ./node_modules/typescript/bin/tsc --pretty false 1>/tmp/tsc.log 2>&1 \
  || (echo "==== TYPESCRIPT ERROR OUTPUT ====" && cat /tmp/tsc.log && exit 1)

# Build TypeScript -> dist/
RUN npm run build || (echo "==== BUILD FAILED: showing tsconfig + file tree ====" && ls -la && ls -la src && cat tsconfig.json && exit 1)

EXPOSE 3001
CMD ["node", "dist/index.js"]
