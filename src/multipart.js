/* jshint node:true */

'use strict'

const multiparty = require('multiparty')
const timeout = require('connect-timeout')

function _mime (req) {
  const str = req.headers[ 'content-type' ] || ''
  return str.split(';')[0]
}

module.exports = function multipart (options) {
  return (req, res, next) => {
    if (_mime(req) !== 'multipart/form-data') return next(null)

    const form = new multiparty.Form({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFieldsSize: options.maxFieldsSize || (2 * 1024), // only field size, not files
      limit: options.limit || '500mb', // file sizes
      autoFiles: true
    })

    // increase timeout of file uploads by default to 3 mins
    if (req.clearTimeout) req.clearTimeout() // clear any previous installed timeout middleware

    timeout(options.timeout || (3 * 60 * 1000))(req, res, () => {
      req.fields = { }
      req.files = { }

      form.parse(req, (err, fields, files) => {
        if (err) return res.status(400).send('Error parsing request')
        next(null)
      })

      form.on('file', (name, file) => {
        req.files[name] = file
      })

      form.on('field', (name, value) => {
        req.fields[name] = value // otherwise fields.name is an array
      })
    })
  }
}

