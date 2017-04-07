#!/bin/bash

set -eu

export NODE_ENV=production

if [ ! -f /app/data/transmission-daemon/transmission.settings.json ]; then
    mkdir -p /app/data/transmission-daemon/
    cp /app/code/transmission.settings.json /app/data/transmission-daemon/transmission.settings.json
fi

if [ ! -f /app/data/session.secret ]; then
    dd if=/dev/random bs=256 count=1 | base64 > /app/data/session.secret
fi

cp /app/data/transmission-daemon/transmission.settings.json /app/data/transmission-daemon/settings.json

node ./writeNginxConfig.js

chown -R cloudron:cloudron /app/data /tmp /run

echo "Starting supervisor"
exec /usr/bin/supervisord --configuration /etc/supervisor/supervisord.conf --nodaemon -i River
