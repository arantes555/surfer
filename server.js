#!/usr/bin/env node

'use strict'

const express = require('express')
const morgan = require('morgan')
const passport = require('passport')
const path = require('path')
const compression = require('compression')
const session = require('express-session')
const bodyParser = require('body-parser')
const lastMile = require('connect-lastmile')
const fs = require('fs')
const multipart_ = require('./src/multipart')
const mkdirp = require('mkdirp')
const files_ = require('./src/files.js')
const contentDisposition = require('content-disposition')
const CloudronStrategy = require('passport-cloudron')
const LokiStore = require('connect-loki')(session)

passport.serializeUser((user, done) => { done(null, user.uid) })

passport.deserializeUser((id, done) => { done(null, {uid: id}) })

passport.use(new CloudronStrategy(
  {callbackURL: process.env.APP_ORIGIN + '/login'},
  (token, tokenSecret, profile, done) => { done(null, {uid: profile.id}) }
))

const isAuthenticated = (req, res, next) => req.isAuthenticated()
  ? next()
  : res.redirect('/login')

const app = express()
const router = new express.Router()

const multipart = multipart_({maxFieldsSize: 2 * 1024, limit: '512mb', timeout: 3 * 60 * 1000})
const files = files_(path.resolve(__dirname, process.argv[2] || 'files'))

app.use(morgan('dev'))
app.use(compression())
app.use('/api/healthcheck', (req, res) => { res.status(200).send() })
app.use(session({
  secret: fs.readFileSync('/app/data/session.secret', 'utf8'),
  store: new LokiStore({
    path: '/app/data/session.db',
    logErrors: true
  }),
  resave: false,
  saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use('/login', passport.authenticate('cloudron'), (req, res) => res.redirect('/'))
app.use('/logout', (req, res) => {
  req.logout()
  res.redirect('/login')
})
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false, limit: '100mb'}))
router.get('/api/files/*', isAuthenticated, files.get)
router.put('/api/files/*', isAuthenticated, multipart, files.put)
router.delete('/api/files/*', isAuthenticated, files.del)
app.use(router)
app.use('/files', isAuthenticated, express.static(path.resolve(__dirname, process.argv[2] || 'files'), {
  index: false,
  setHeaders: (res, path) => res.setHeader('Content-Disposition', contentDisposition(path))
}))
app.use('/', isAuthenticated, express.static(path.resolve(__dirname, 'app')))
app.use(lastMile())

const server = app.listen(3000, function () {
  const {host, port} = server.address()

  const basePath = path.resolve(__dirname, process.argv[2] || 'files')
  mkdirp.sync(basePath)

  console.log('River listening at http://%s:%s', host, port)
  console.log('Using base path', basePath)
})
