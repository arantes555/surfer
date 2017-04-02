#!/bin/bash

set -eu

export NODE_ENV=production

if [ ! -f /app/data/transmission-daemon/settings.json ]; then
    mkdir -p /app/data/transmission-daemon/
    cp /etc/transmission-daemon/settings.json.default /app/data/transmission-daemon/settings.json
fi

chown -R cloudron:cloudron /app/data /tmp /run

echo "Starting supervisor"
/usr/bin/supervisord --configuration /etc/supervisor/supervisord.conf --nodaemon -i River
