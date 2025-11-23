# Use a lightweight base image
FROM nginx:alpine

# Copy the static website files to the Nginx document root
COPY frontend.html /usr/share/nginx/html/index.html
COPY frontend_scripts.js /usr/share/nginx/html/frontend_scripts.js