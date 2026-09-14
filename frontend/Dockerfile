# Builds the SPA and serves it with nginx. The API URL is baked in at build
# time (Vite inlines VITE_* variables), so pass it as a build arg.
FROM node:22-alpine AS build
ARG VITE_API_BASE_URL=http://localhost:8000/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
WORKDIR /repo
# The app imports ../shared, so the build needs both folders.
COPY shared ./shared
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci
COPY frontend ./frontend
RUN cd frontend && npx vite build

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/frontend/dist /usr/share/nginx/html
EXPOSE 80
