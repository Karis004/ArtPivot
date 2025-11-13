# Build and run the ArtPivot backend
# Stage 1: install all dependencies (including dev) for the build step
FROM node:22-alpine AS deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm install

# Stage 2: compile TypeScript using the full dependency set
FROM node:22-alpine AS build
WORKDIR /app
COPY backend/package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ ./
RUN npm run build

# Stage 3: install only production dependencies to keep the final image slim
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev

# Stage 4: runtime image with compiled JS and production deps
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package*.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY backend/uploads ./uploads
EXPOSE 5001
CMD ["node", "dist/server.js"]
