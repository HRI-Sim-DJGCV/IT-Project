# Build context is the repository root (the API compiles ../shared too).
FROM node:22-alpine AS build
WORKDIR /repo
COPY shared ./shared
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm ci
COPY backend ./backend
RUN cd backend && npm run build

FROM node:22-alpine
WORKDIR /repo/backend
ENV NODE_ENV=production
COPY --from=build /repo/backend/package.json ./
COPY --from=build /repo/backend/node_modules ./node_modules
COPY --from=build /repo/backend/dist ./dist
# Generated audio lives here; Compose mounts a volume on it.
RUN mkdir -p /repo/backend/data/audio
EXPOSE 8000
CMD ["node", "dist/backend/src/index.js"]
