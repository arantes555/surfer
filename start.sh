#!/bin/bash

set -eu

export NODE_ENV=production

if [ ! -f /app/data/transmission-daemon/settings.json ]; then
    mkdir -p /app/data/transmission-daemon/
    cp /etc/transmission-daemon/settings.json.default /app/data/transmission-daemon/settings.json
fi

chown -R cloudron:cloudron /app/data

/usr/local/bin/gosu cloudron:cloudron transmission-daemon --config-dir /app/data/transmission-daemon/
/usr/local/bin/gosu cloudron:cloudron node /app/code/server.js /app/data
