'use strict'

const async = require('async')
const fs = require('fs')
const path = require('path')
const rm = require('del')
const debug = require('debug')('files')
const mkdirp = require('mkdirp')
const HttpError = require('connect-lastmile').HttpError
const HttpSuccess = require('connect-lastmile').HttpSuccess

let gBasePath

exports = module.exports = basePath => {
  gBasePath = basePath

  return {
    get: get,
    put: put,
    del: del
  }
}

// http://stackoverflow.com/questions/11293857/fastest-way-to-copy-file-in-node-js
function copyFile (source, target, cb) {
  let cbCalled = false

  // ensure directory
  mkdirp(path.dirname(target), error => {
    if (error) return cb(error)

    const rd = fs.createReadStream(source)
    rd.on('error', err => done(err))

    const wr = fs.createWriteStream(target)
    wr.on('error', err => done(err))

    wr.on('close', ex => done())

    rd.pipe(wr)

    const done = err => {
      if (!cbCalled) {
        cb(err)
        cbCalled = true
      }
    }
  })
}

function createDirectory (targetPath, callback) {
  mkdirp(targetPath, error => {
    if (error) return callback(error)
    callback(null)
  })
}

function isProtected (targetPath) {
  return targetPath.indexOf(getAbsolutePath('_admin')) === 0
}

function getAbsolutePath (filePath) {
  const absoluteFilePath = path.resolve(path.join(gBasePath, filePath))

  if (absoluteFilePath.indexOf(gBasePath) !== 0) return null
  return absoluteFilePath
}

function removeBasePath (filePath) {
  return filePath.slice(gBasePath.length)
}

function get (req, res, next) {
  const filePath = decodeURIComponent(req.params[0])
  let absoluteFilePath = getAbsolutePath(filePath)
  if (!absoluteFilePath) return next(new HttpError(403, 'Path not allowed'))

  fs.stat(absoluteFilePath, (error, result) => {
    if (error) return next(new HttpError(404, error))

    debug('get', absoluteFilePath)

    if (!result.isDirectory() && !result.isFile()) return next(new HttpError(500, 'unsupported type'))
    if (result.isFile()) return res.sendFile(absoluteFilePath)

    async.map(fs.readdirSync(absoluteFilePath), (filePath, callback) => {
      fs.stat(path.join(absoluteFilePath, filePath), (error, result) => {
        if (error) return callback(error)

        callback(null, {
          isDirectory: result.isDirectory(),
          isFile: result.isFile(),
          atime: result.atime,
          mtime: result.mtime,
          ctime: result.ctime,
          birthtime: result.birthtime,
          size: result.size,
          filePath: filePath
        })
      })
    }, (error, results) => {
      if (error) return next(new HttpError(500, error))
      res.status(222).send({entries: results})
    })
  })
}

function put (req, res, next) {
  const filePath = decodeURIComponent(req.params[0])

  if (!(req.files && req.files.file) && !req.query.directory) return next(new HttpError(400, 'missing file or directory'))
  if ((req.files && req.files.file) && req.query.directory) return next(new HttpError(400, 'either file or directory'))

  let absoluteFilePath = getAbsolutePath(filePath)
  if (!absoluteFilePath || isProtected(absoluteFilePath)) return next(new HttpError(403, 'Path not allowed'))

  fs.stat(absoluteFilePath, (error, result) => {
    if (error && error.code !== 'ENOENT') return next(new HttpError(500, error))

    debug('put', absoluteFilePath)

    if (result && req.query.directory) return next(new HttpError(409, 'name already exists'))
    if (result && result.isDirectory()) return next(new HttpError(409, 'cannot put on directories'))

    if (req.query.directory) {
      return createDirectory(absoluteFilePath, (error) => {
        if (error) return next(new HttpError(500, error))
        next(new HttpSuccess(201, {}))
      })
    } else if (!result || result.isFile()) {
      return copyFile(req.files.file.path, absoluteFilePath, (error) => {
        if (error) return next(new HttpError(500, error))
        next(new HttpSuccess(201, {}))
      })
    }

    return next(new HttpError(500, 'unsupported type'))
  })
}

function del (req, res, next) {
  const filePath = decodeURIComponent(req.params[0])
  const recursive = !!req.query.recursive
  const dryRun = !!req.query.dryRun

  let absoluteFilePath = getAbsolutePath(filePath)
  if (!absoluteFilePath) return next(new HttpError(404, 'Not found'))

  if (isProtected(absoluteFilePath)) return next(new HttpError(403, 'Path not allowed'))

  // absoltueFilePath has to have the base path prepended
  if (absoluteFilePath.length <= gBasePath.length) return next(new HttpError(404, 'Not found'))

  fs.stat(absoluteFilePath, (error, result) => {
    if (error) return next(new HttpError(404, error))

    if (result.isDirectory() && !recursive) return next(new HttpError(403, 'Is directory'))

    // add globs to get file listing
    if (result.isDirectory()) absoluteFilePath += '/**'

    // Escaping characters that would form pattern
    absoluteFilePath = absoluteFilePath
      .replace(/\[/g, '\\[')
      .replace(/]/g, '\\]')

    rm([absoluteFilePath], {dryRun: dryRun, force: true})
      .then(result => {
        result = result.map(removeBasePath)
        next(new HttpSuccess(200, {entries: result}))
      }, error => {
        console.error(error)
        next(new HttpError(500, 'Unable to remove'))
      })
  })
}
