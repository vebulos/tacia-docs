# Stage 1: Build the Angular application
FROM node:20-alpine AS build

WORKDIR /app

# Copy package configuration and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the application
# The output will be in /app/dist/frontend/browser
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:1.29.0-alpine

# Set image labels
LABEL org.opencontainers.image.source="https://github.com/yourusername/tacia-docs"
LABEL org.opencontainers.image.title="Tacia Frontend"
LABEL org.opencontainers.image.description="Frontend application for Tacia documentation system"

# Install gettext for envsubst utility
RUN apk add --no-cache gettext

# Copy the nginx configuration template
COPY nginx.conf /etc/nginx/templates/nginx.conf.template

# Copy the entrypoint script
COPY entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy built Angular app from the build stage
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

# Expose port and set the entrypoint
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
