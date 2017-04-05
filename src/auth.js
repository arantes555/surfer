'use strict'

const passport = require('passport')
const path = require('path')
const safe = require('safetydance')
const LdapStrategy = require('passport-ldapjs').Strategy

const LOCAL_AUTH_FILE = path.resolve(process.env.LOCAL_AUTH_FILE || './.users.json')

passport.serializeUser((user, done) => {
  console.log('serializeUser', user)
  done(null, user.uid)
})

passport.deserializeUser((id, done) => {
  console.log('deserializeUser', id)
  done(null, { uid: id })
})

const LDAP_URL = process.env.LDAP_URL
const LDAP_USERS_BASE_DN = process.env.LDAP_USERS_BASE_DN

if (LDAP_URL && LDAP_USERS_BASE_DN) {
  console.log('Enable ldap auth')

  exports.verify = passport.authenticate('ldap')
} else {
  console.log('Use local user file:', LOCAL_AUTH_FILE)

  exports.verify = (req, res, next) => {
    let users = safe.JSON.parse(safe.fs.readFileSync(LOCAL_AUTH_FILE))
    if (!users) return res.send(401)
    if (!users[req.query.username]) return res.send(401)

    if (req.query.password && req.query.password === users[req.query.username]) return next()
    else return res.send(401)
  }
}

const opts = {
  server: {
    url: LDAP_URL
  },
  base: LDAP_USERS_BASE_DN,
  search: {
    filter: '(|(username={{username}})(mail={{username}}))',
    attributes: [ 'displayname', 'username', 'mail', 'uid' ],
    scope: 'sub'
  },
  uidTag: 'cn',
  usernameField: 'username',
  passwordField: 'password'
}

passport.use(new LdapStrategy(opts, (profile, done) => {
  done(null, profile)
}))
