# Stage 1: Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Install build dependencies for sqlite (if needed)
RUN apk add --no-cache python3 make g++ sqlite

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app source code
COPY . .

# Stage 2: Final runtime image
FROM node:18-alpine

WORKDIR /app

# Install runtime dependency sqlite (without build tools)
RUN apk add --no-cache sqlite

# Copy only the app and production dependencies from builder
COPY --from=builder /app /app

# Create a non-root user and switch to it
RUN addgroup -S appuser && adduser -S appuser -G appuser
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 3000

CMD ["node", "server.js"]
