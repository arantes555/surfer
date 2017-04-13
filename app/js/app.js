/* global superagent, $, Vue, FormData, filesize */

(function () {
  'use strict'

  function logout () {
    window.location.href = '/logout'
  }

  function sanitize (filePath) {
    filePath = '/' + filePath
    return filePath.replace(/\/+/g, '/')
  }

  function encode (filePath) {
    return filePath.split('/').map(encodeURIComponent).join('/')
  }

  function decode (filePath) {
    return filePath.split('/').map(decodeURIComponent).join('/')
  }

  const mimeTypes = {
    images: ['.png', '.jpg', '.jpeg', '.tiff', '.gif'],
    text: ['.txt', '.md'],
    pdf: ['.pdf'],
    html: ['.html', '.htm', '.php'],
    video: ['.mp4', '.mpg', '.mpeg', '.ogg', '.mkv']
  }

  function getPreviewUrl (entry, basePath) {
    const path = '/img/'

    if (entry.isDirectory) return path + 'directory.png'
    if (mimeTypes.images.some(e => entry.filePath.toLowerCase().endsWith(e))) return sanitize('/files' + basePath + '/' + entry.filePath)
    if (mimeTypes.text.some(e => entry.filePath.toLowerCase().endsWith(e))) return path + 'text.png'
    if (mimeTypes.pdf.some(e => entry.filePath.toLowerCase().endsWith(e))) return path + 'pdf.png'
    if (mimeTypes.html.some(e => entry.filePath.toLowerCase().endsWith(e))) return path + 'html.png'
    if (mimeTypes.video.some(e => entry.filePath.toLowerCase().endsWith(e))) return path + 'video.png'

    return path + 'unknown.png'
  }

  function refresh () {
    loadDirectory(app.path)
  }

  function loadDirectory (filePath) {
    resetDrag()
    app.busy = true

    filePath = filePath ? sanitize(filePath) : '/'

    superagent.get('/api/files/' + filePath)
      .end((error, result) => {
        app.busy = false

        if (result && result.statusCode === 401) return logout()
        if (error) return console.error(error)

        result.body.entries.sort((a, b) => a.isDirectory && b.isFile ? -1 : 1)
        app.entries = result.body.entries.map((entry) => {
          entry.previewUrl = getPreviewUrl(entry, filePath)
          return entry
        })
        app.path = filePath
        app.pathParts = decode(filePath).split('/').filter(e => !!e).map((e, i, a) => {
          return {
            name: e,
            link: '#' + sanitize('/' + a.slice(0, i).join('/') + '/' + e)
          }
        })

        // update in case this was triggered from code
        window.location.hash = app.path

        Vue.nextTick(() => {
          $(() => {
            $('[data-toggle="tooltip"]').tooltip()
          })
        })
      })
  }

  function getUrl (entry) {
    const path = sanitize(app.path + '/' + entry.filePath)
    if (entry.isDirectory) return '#' + path
    else return '/files' + path
  }

  function open (entry) {
    const path = sanitize(app.path + '/' + entry.filePath)
    if (entry.isDirectory) {
      window.location.hash = path
    } else {
      window.location.href = '/files' + path
    }
  }

  function up () {
    window.location.hash = sanitize(app.path.split('/').slice(0, -1).filter(p => !!p).join('/'))
  }

  function upload () {
    $(app.$els.upload).on('change', () => {
      app.busy = true

      // detach event handler
      $(app.$els.upload).off('change')

      const length = app.$els.upload.files.length
      let done = 0

      function uploadFile (file) {
        const path = sanitize(app.path + '/' + encode(file.name))

        const formData = new FormData()
        formData.append('file', file)

        superagent.put('/api/files' + path)
          .send(formData)
          .end((error, result) => {
            if (result && result.statusCode === 401) return logout()
            if (result && result.statusCode !== 201) console.error('Error uploading file: ', result.statusCode)
            if (error) console.error(error)

            done++

            if (done >= length) {
              app.busy = false
              refresh()
            }
          })
      }

      for (let i = 0; i < length; i++) {
        uploadFile(app.$els.upload.files[i])
      }
    })

    // reset the form first to make the change handler retrigger even on the same file selected
    $('#fileUploadForm')[0].reset()

    app.$els.upload.click()
  }

  $('#modalDelete').on('shown.bs.modal', function () {
    $('#deleteNoBtn').focus()
  })

  function delAsk (entry) {
    $('#modalDelete').modal('show')
    app.deleteData = entry
  }

  function del (entry) {
    app.busy = true

    const path = sanitize(app.path + '/' + encode(entry.filePath))

    superagent.del('/api/files' + path)
      .query({
        recursive: true
      })
      .end((error, result) => {
        app.busy = false

        if (result && result.statusCode === 401) return logout()
        if (result && result.statusCode !== 200) return console.error('Error deleting file: ', result.statusCode)
        if (error) return console.error(error)

        refresh()

        $('#modalDelete').modal('hide')
      })
  }

  $('#modalcreateDirectory').on('shown.bs.modal', function () {
    $('#inputDirectoryName').focus()
  })

  function createDirectoryAsk () {
    $('#modalcreateDirectory').modal('show')
    app.createDirectoryData = ''
    app.createDirectoryError = null
  }

  function createDirectory (name) {
    app.busy = true
    app.createDirectoryError = null

    const path = sanitize(app.path + '/' + encode(name))

    superagent.put('/api/files' + path)
      .query({
        directory: true
      })
      .end((error, result) => {
        app.busy = false

        if (result && result.statusCode === 401) return logout()
        if (result && result.statusCode === 403) {
          app.createDirectoryError = 'Name not allowed'
          return
        }
        if (result && result.statusCode === 409) {
          app.createDirectoryError = 'Directory already exists'
          return
        }
        if (result && result.statusCode !== 201) return console.error('Error creating directory: ', result.statusCode)
        if (error) return console.error(error)

        app.createDirectoryData = ''
        refresh()

        $('#modalcreateDirectory').modal('hide')
      })
  }

  $('#modalRename').on('shown.bs.modal', function () {
    $('#inputRename').select()
  })

  function renameAsk (entry) {
    $('#modalRename').modal('show')
    app.renameOld = entry.filePath
    app.renameNew = app.renameOld
    app.renameError = null
  }

  function move (oldPath, newPath, callback) {
    app.busy = true

    superagent.put('/api/files' + newPath)
      .query({
        from: decode(oldPath)
      })
      .end((error, result) => {
        app.busy = false

        if (result && result.statusCode === 401) {
          callback('Unauthorized')
          return logout()
        }
        if (result && result.statusCode === 403) return callback('Name not allowed')
        if (result && result.statusCode === 409) return callback('Already exists')
        if (result && result.statusCode !== 201) return callback('Error moving file: ', result.statusCode)
        if (error) return callback(error.toString())
        callback()
      })
  }

  function rename (oldName, newName) {
    app.renameError = null

    const oldPath = sanitize(app.path + '/' + encode(oldName))
    const newPath = sanitize(app.path + '/' + encode(newName))

    move(oldPath, newPath, function (error) {
      if (error) {
        app.renameError = error
        return
      }
      app.renameOld = ''
      app.renameNew = ''
      refresh()
      $('#modalRename').modal('hide')
    })
  }

  function onDrag (event, entry) {
    event.dataTransfer.setData('text', entry.filePath)
  }

  function shouldAllowDrop (event, entry) {
    if (entry === '..' || entry.isDirectory) event.preventDefault() // Allow drop only on directories
  }

  function onDrop (event, entry) {
    if (!(entry === '..' || entry.isDirectory)) throw new Error('Trying to move to another file') // just to be safe
    const origin = event.dataTransfer.getData('text')
    if (origin === entry.filePath) return
    const originPath = sanitize(app.path + '/' + encode(origin))
    const destinationDir = entry === '..'
      ? app.path.replace(/\/$/, '').split('/').slice(0, -1).join('/') + '/' // removing last leaf from current path
      : app.path + '/' + encode(entry.filePath) // Adding dir name to current path
    const destinationPath = sanitize(destinationDir + '/' + encode(origin))

    move(originPath, destinationPath, function (error) {
      if (error) return console.error(error)
      refresh()
    })
  }

  let dragCounter = {}

  function onDragEnter (event, entry) {
    if (entry === '..' || entry.isDirectory) {
      const name = (entry === '..') ? '..' : entry.filePath
      dragCounter[name] = (dragCounter[name] || 0) + 1
      if (event.target.tagName === 'TR') $(event.target).addClass('dragged-over')
      else $(event.target).parent('tr').addClass('dragged-over')
    }
  }

  function onDragLeave (event, entry) {
    if (entry === '..' || entry.isDirectory) {
      const name = (entry === '..') ? '..' : entry.filePath
      dragCounter[name] = dragCounter[name] - 1
      if (dragCounter[name] <= 0) {
        dragCounter[name] = 0
        if (event.target.tagName === 'TR') $(event.target).removeClass('dragged-over')
        else $(event.target).parent('tr').removeClass('dragged-over')
      }
    }
  }

  function resetDrag () {
    $('tr').removeClass('dragged-over')
    dragCounter = {}
  }

  $(window).on('dragend', resetDrag)

  Vue.filter('prettyDate', (value) => {
    const d = new Date(value)
    return d.toDateString()
  })

  Vue.filter('prettyFileSize', (value) => {
    return filesize(value)
  })

  const app = new Vue({
    el: '#app',
    data: {
      busy: true,
      path: '/',
      pathParts: [],
      deleteData: {},
      createDirectoryData: '',
      createDirectoryError: null,
      renameOld: '',
      renameNew: '',
      renameError: null,
      entries: []
    },
    methods: {
      logout: logout,
      loadDirectory: loadDirectory,
      getUrl: getUrl,
      up: up,
      upload: upload,
      delAsk: delAsk,
      del: del,
      open: open,
      refresh: refresh,
      createDirectoryAsk: createDirectoryAsk,
      createDirectory: createDirectory,
      renameAsk: renameAsk,
      rename: rename,
      prettyFileSize: filesize,
      onDrag: onDrag,
      shouldAllowDrop: shouldAllowDrop,
      onDrop: onDrop,
      onDragEnter: onDragEnter,
      onDragLeave: onDragLeave
    }
  })

  window.app = app

  loadDirectory(window.location.hash.slice(1))

  $(window).on('hashchange', () => {
    loadDirectory(window.location.hash.slice(1))
  });

// setup all the dialog focus handling
  ['modalcreateDirectory'].forEach((id) => {
    $('#' + id).on('shown.bs.modal', function () {
      $(this).find('[autofocus]:first').focus()
    })
  })
})()
