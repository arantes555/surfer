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
    app.busy = true

    filePath = filePath ? sanitize(filePath) : '/'

    superagent.get('/api/files/' + encode(filePath))
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
        const path = encode(sanitize(app.path + '/' + file.name))

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

  function delAsk (entry) {
    $('#modalDelete').modal('show')
    app.deleteData = entry
  }

  function del (entry) {
    app.busy = true

    const path = encode(sanitize(app.path + '/' + entry.filePath))

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

  function createDirectoryAsk () {
    $('#modalcreateDirectory').modal('show')
    app.createDirectoryData = ''
    app.createDirectoryError = null
  }

  function createDirectory (name) {
    app.busy = true
    app.createDirectoryError = null

    const path = encode(sanitize(app.path + '/' + name))

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
      entries: []
    },
    methods: {
      logout: logout,
      loadDirectory: loadDirectory,
      open: open,
      up: up,
      upload: upload,
      delAsk: delAsk,
      del: del,
      createDirectoryAsk: createDirectoryAsk,
      createDirectory: createDirectory
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
