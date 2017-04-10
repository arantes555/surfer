#!/usr/bin/env node
'use strict'

const fs = require('fs')
const torrentPort = parseInt(process.env.TORRENT_PORT || 51413)

const config = JSON.parse(
  fs.readFileSync('/app/data/transmission-daemon/transmission.settings.json', 'utf8')
)

config['peer-port'] = torrentPort

fs.writeFileSync(
  '/app/data/transmission-daemon/settings.json',
  JSON.stringify(config)
)
