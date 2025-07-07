# Frontend Dockerfile
FROM node:20-alpine as build
WORKDIR /app
COPY workspace/frontend/package.json workspace/frontend/package-lock.json* ./
RUN npm install
COPY workspace/frontend .
RUN npm run build

# Production image
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
