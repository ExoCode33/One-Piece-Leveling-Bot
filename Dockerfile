# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install instead of npm ci)
RUN npm install --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S bot -u 1001
USER bot

# Expose port (Railway will set PORT env variable)
EXPOSE $PORT

# Start the application
CMD ["npm", "start"]
