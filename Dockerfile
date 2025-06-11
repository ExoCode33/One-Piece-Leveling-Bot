# Dockerfile
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S discord -u 1001

# Change ownership of the app directory
RUN chown -R discord:nodejs /usr/src/app
USER discord

# Expose port (optional, for health checks)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "console.log('Bot is running')" || exit 1

# Start the application
CMD ["npm", "start"]
