FROM node:22-alpine

# Set clinic timezone
RUN apk add --no-cache tzdata
ENV TZ=Asia/Kolkata
ENV NODE_ENV=production

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Clean production install with exact lockfile resolution
RUN npm ci --omit=dev

# Copy application files
COPY . .

# Ensure data directory exists with correct permissions for non-root user
RUN mkdir -p /app/data /app/data/backups && chown -R node:node /app

# Switch to standard non-root user
USER node

EXPOSE 3000

CMD ["node", "server.js"]
