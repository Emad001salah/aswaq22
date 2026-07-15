FROM nginx:alpine

# Copy main configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create an empty .htpasswd file so Nginx starts even if basic auth is not configured yet
RUN touch /etc/nginx/.htpasswd

EXPOSE 80 443
