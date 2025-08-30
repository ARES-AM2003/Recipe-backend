# Stage 1: Build with Node (Alpine)
FROM node:20-alpine AS build
WORKDIR /app

# Install only dependencies needed for build
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Run with Bun (slim)
FROM oven/bun:slim
WORKDIR /app

# Copy only built artifacts
COPY --from=build /app/dist ./dist

# Copy only production dependencies
COPY package.json bun.lockb* ./

# Install only production dependencies
RUN bun install --production --ignore-scripts

# Expose port
EXPOSE 3000

# Run app
CMD ["bun", "dist/src/main.js"]
