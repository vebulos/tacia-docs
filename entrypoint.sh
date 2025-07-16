#!/bin/sh
set -e

# Use envsubst to replace ${BACKEND_SERVICE} in the template with the value of the environment variable
# and write the output to the final nginx configuration file.
envsubst '${BACKEND_SERVICE}' < /etc/nginx/templates/nginx.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx in the foreground
exec nginx -g 'daemon off;'
