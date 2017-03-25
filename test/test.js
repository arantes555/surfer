#!/usr/bin/env node

'use strict'

/* global describe, before, after, it, xit */

const execSync = require('child_process').execSync
const expect = require('expect.js')
const path = require('path')
const fs = require('fs')
const superagent = require('superagent')
const webdriver = require('selenium-webdriver')

const by = webdriver.By
const until = webdriver.until

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

if (!process.env.USERNAME || !process.env.PASSWORD) {
  console.log('USERNAME and PASSWORD env vars need to be set')
  process.exit(1)
}

describe('Application life cycle test', function () {
  this.timeout(0)

  const chrome = require('selenium-webdriver/chrome')
  let server
  const browser = new chrome.Driver()

  before((done) => {
    const seleniumJar = require('selenium-server-standalone-jar')
    const SeleniumServer = require('selenium-webdriver/remote').SeleniumServer
    server = new SeleniumServer(seleniumJar.path, { port: 4444 })
    server.start()

    done()
  })

  after((done) => {
    browser.quit()
    server.stop()
    done()
  })

  const LOCATION = 'surfer'
  const TEST_TIMEOUT = 10000
  const TEST_FILE_NAME_0 = 'index.html'
  const TEST_FILE_NAME_1 = 'test.txt'
  let app

  // tests which are used more than once
  function login (done) {
    browser.manage().deleteAllCookies()
    browser.get('https://' + app.fqdn + '/_admin')

    browser.wait(until.elementLocated(by.id('inputUsername')), TEST_TIMEOUT).then(() => {
      browser.wait(until.elementIsVisible(browser.findElement(by.id('inputUsername'))), TEST_TIMEOUT).then(() => {
        browser.findElement(by.id('inputUsername')).sendKeys(process.env.USERNAME)
        browser.findElement(by.id('inputPassword')).sendKeys(process.env.PASSWORD)
        browser.findElement(by.id('loginForm')).submit()

        browser.wait(until.elementIsVisible(browser.findElement(by.id('logoutButton'))), TEST_TIMEOUT).then(() => {
          done()
        })
      })
    })
  }

  function logout (done) {
    browser.get('https://' + app.fqdn + '/_admin')

    browser.wait(until.elementLocated(by.id('logoutButton')), TEST_TIMEOUT).then(() => {
      browser.wait(until.elementIsVisible(browser.findElement(by.id('logoutButton'))), TEST_TIMEOUT).then(() => {
        browser.findElement(by.id('logoutButton')).click()

        browser.wait(until.elementIsVisible(browser.findElement(by.id('inputPassword'))), TEST_TIMEOUT).then(() => {
          done()
        })
      })
    })
  }

  function checkFileIsListed (name, done) {
    browser.get('https://' + app.fqdn + '/_admin')

    browser.wait(until.elementLocated(by.xpath('//*[text()="' + name + '"]')), TEST_TIMEOUT).then(() => {
      done()
    })
  }

  function checkFileIsPresent (done) {
    browser.get('https://' + app.fqdn + '/' + TEST_FILE_NAME_0)

    browser.wait(until.elementLocated(by.xpath('//*[text()="test"]')), TEST_TIMEOUT).then(() => {
      done()
    })
  }

  function checkIndexFileIsServedUp (done) {
    browser.get('https://' + app.fqdn)

    browser.wait(until.elementLocated(by.xpath('//*[text()="test"]')), TEST_TIMEOUT).then(() => {
      done()
    })
  }

  function checkFileIsGone (name, done) {
    superagent.get('https://' + app.fqdn + '/' + name).end((error, result) => {
      expect(error).to.be.an('object')
      expect(result.statusCode).to.equal(404)
      done()
    })
  }

  function uploadFile (name, done) {
    // File upload can't be tested with selenium, since the file input is not visible and thus can't be interacted with :-(

    fs.writeFileSync(process.env.HOME + '/.surfer.json', JSON.stringify({
      server: 'https://' + app.fqdn,
      username: process.env.USERNAME,
      password: process.env.PASSWORD
    }))
    execSync(path.join(__dirname, '/../cli/surfer.js') + ' put ' + path.join(__dirname, name), { stdio: 'inherit' })
    done()
  }

  xit('build app', () => {
    execSync('cloudron build', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' })
  })

  it('install app', () => {
    execSync('cloudron install --new --wait --location ' + LOCATION, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit'
    })
  })

  it('can get app information', () => {
    const inspect = JSON.parse(execSync('cloudron inspect'))

    app = inspect.apps.filter((a) => { return a.location === LOCATION })[ 0 ]

    expect(app).to.be.an('object')
  })

  it('can login', login)
  it('can upload file', uploadFile.bind(null, TEST_FILE_NAME_0))
  it('file is listed', checkFileIsListed.bind(null, TEST_FILE_NAME_0))
  it('file is served up', checkFileIsPresent)
  it('file is served up', checkIndexFileIsServedUp)
  it('can upload second file', uploadFile.bind(null, TEST_FILE_NAME_1))
  it('file is listed', checkFileIsListed.bind(null, TEST_FILE_NAME_1))
  it('can delete second file with cli', (done) => {
    fs.writeFileSync(process.env.HOME + '/.surfer.json', JSON.stringify({
      server: 'https://' + app.fqdn,
      username: process.env.USERNAME,
      password: process.env.PASSWORD
    }))
    execSync(path.join(__dirname, '/../cli/surfer.js') + ' del ' + TEST_FILE_NAME_1, { stdio: 'inherit' })
    done()
  })
  it('second file is gone', checkFileIsGone.bind(null, TEST_FILE_NAME_1))
  it('can logout', logout)

  it('backup app', () => {
    execSync('cloudron backup create --app ' + app.id, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' })
  })

  it('restore app', () => {
    execSync('cloudron restore --app ' + app.id, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' })
  })

  it('can login', login)
  it('file is listed', checkFileIsListed.bind(null, TEST_FILE_NAME_0))
  it('file is served up', checkFileIsPresent)
  it('file is served up', checkIndexFileIsServedUp)
  it('second file is still gone', checkFileIsGone.bind(null, TEST_FILE_NAME_1))
  it('can logout', logout)

  it('move to different location', () => {
    browser.manage().deleteAllCookies()
    execSync('cloudron install --location ' + LOCATION + '2 --app ' + app.id, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit'
    })
    const inspect = JSON.parse(execSync('cloudron inspect'))
    app = inspect.apps.filter((a) => { return a.location === LOCATION + '2' })[ 0 ]
    expect(app).to.be.an('object')
  })

  it('can login', login)
  it('file is listed', checkFileIsListed.bind(null, TEST_FILE_NAME_0))
  it('file is served up', checkFileIsPresent)
  it('file is served up', checkIndexFileIsServedUp)
  it('can logout', logout)

  it('uninstall app', () => {
    execSync('cloudron uninstall --app ' + app.id, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' })
  })
})
