# Multi-stage build for EcliPay Backend
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies including devDependencies
RUN npm ci --only=production=false

# Copy source code and build configuration
COPY src ./src
COPY tsconfig.json nest-cli.json ./

# Build the application
RUN npm run build

# Production runner stage
FROM node:18-alpine AS runner

# Install runtime dependencies
RUN apk add --no-cache wget curl

# Create app user for security
RUN addgroup -g 1001 -S nodejs && adduser -S eclipay -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create necessary directories
RUN mkdir -p uploads/logos && chown -R eclipay:nodejs uploads

# Switch to non-root user
USER eclipay

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/main.js"]