#!/bin/bash

set -eu

export NODE_ENV=production

if [ ! -f /app/data/transmission-daemon/transmission.settings.json ]; then
    mkdir -p /app/data/transmission-daemon/
    cp /app/code/transmission.settings.json /app/data/transmission-daemon/transmission.settings.json
fi

cp /app/data/transmission-daemon/transmission.settings.json /app/data/transmission-daemon/settings.json

./nginx.sh > /run/nginx.conf

chown -R cloudron:cloudron /app/data /tmp /run

echo "Starting supervisor"
/usr/bin/supervisord --configuration /etc/supervisor/supervisord.conf --nodaemon -i River
