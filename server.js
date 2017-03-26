#!/usr/bin/env node

'use strict'

const express = require('express')
const morgan = require('morgan')
const passport = require('passport')
const path = require('path')
const compression = require('compression')
const session = require('express-session')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const lastMile = require('connect-lastmile')
const multipart_ = require('./src/multipart')
const mkdirp = require('mkdirp')
const auth = require('./src/auth.js')
const files_ = require('./src/files.js')
const httpProxy = require('http-proxy')
const apiProxy = httpProxy.createProxyServer()

const app = express()
const router = new express.Router()

const multipart = multipart_({ maxFieldsSize: 2 * 1024, limit: '512mb', timeout: 3 * 60 * 1000 })
const files = files_(path.resolve(__dirname, process.argv[ 2 ] || 'files'))

router.all('/transmission/*', function (req, res) {
  const headers = {}
  if (req.headers[ 'X-Transmission-Session-Id' ]) headers[ 'X-Transmission-Session-Id' ] = req.headers[ 'X-Transmission-Session-Id' ]
  else if (req.headers[ 'x-transmission-session-id' ]) headers[ 'x-transmission-session-id' ] = req.headers[ 'x-transmission-session-id' ]

  console.log('headers :', headers)
  console.log('req.headers :', req.headers)

  apiProxy.web(req, res, {
    target: 'http://localhost:9091',
    xfwd: true,
    changeOrigin: true,
    cookieDomainRewrite: true,
    preserveHeaderKeyCase: true,
    headers
  })
})

router.get('/api/files/*', auth.verify, files.get)
router.put('/api/files/*', auth.verify, multipart, files.put)
router.delete('/api/files/*', auth.verify, files.del)
router.get('/api/healthcheck', (req, res) => { res.status(200).send() })

// welcome screen in case / does not serve up any file yet
router.get('/', (req, res) => { res.status(200).sendFile(path.join(__dirname, '/app/welcome.html')) })

app.use(morgan('dev'))
app.use(compression())
app.use('/_admin', express.static(path.resolve(__dirname, 'app')))
app.use(express.static(path.resolve(__dirname, process.argv[ 2 ] || 'files')))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false, limit: '100mb' }))
app.use(cookieParser())
app.use(session({ secret: 'surfin surfin', resave: false, saveUninitialized: false }))
app.use(passport.initialize())
app.use(passport.session())
app.use(router)
app.use(lastMile())

const server = app.listen(3000, function () {
  const host = server.address().address
  const port = server.address().port

  const basePath = path.resolve(__dirname, process.argv[ 2 ] || 'files')
  mkdirp.sync(basePath)

  console.log('Surfer listening at http://%s:%s', host, port)
  console.log('Using base path', basePath)
})
