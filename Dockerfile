# Stage 1: Build with Node (Alpine)
FROM node:20-alpine AS build
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy only package files first (better caching)
COPY package.json package-lock.json* ./

# Install deps (with legacy peer deps for compatibility)
RUN npm install --legacy-peer-deps

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Run with Bun (slim)
FROM oven/bun:slim
WORKDIR /app

# Copy built artifacts
COPY --from=build /app/dist ./dist

# Copy package manifests
COPY package.json bun.lockb* ./

# Install only production dependencies (skip scripts for safety)
RUN bun install --production --ignore-scripts

# Expose app port
EXPOSE 3000

# Run the app
CMD ["bun", "dist/src/main.js"]
