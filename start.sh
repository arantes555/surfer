#!/bin/bash

set -eu

export NODE_ENV=production

# Copy the default transmission settings to a user-modifiable place
if [ ! -f /app/data/transmission-daemon/transmission.settings.json ]; then
    mkdir -p /app/data/transmission-daemon/
    cp /app/code/transmission.settings.json /app/data/transmission-daemon/transmission.settings.json
fi

# Creating a secret for passport's sessions
if [ ! -f /app/data/session.secret ]; then
    dd if=/dev/random bs=256 count=1 | base64 > /app/data/session.secret
fi

# Writing config files
node ./writeNginxConfig.js
node ./writeTransmissionConfig.js

chown -R cloudron:cloudron /app/data /tmp /run

echo "Starting supervisor"
exec /usr/bin/supervisord --configuration /etc/supervisor/supervisord.conf --nodaemon -i River
