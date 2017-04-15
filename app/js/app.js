/* global superagent, $, Vue, FormData, filesize */

(function () {
  'use strict'

  const sanitize = (filePath) => ('/' + filePath).replace(/\/+/g, '/')

  const encode = (filePath) => filePath.split('/').map(encodeURIComponent).join('/')

  const decode = (filePath) => filePath.split('/').map(decodeURIComponent).join('/')

  const getExt = (name) => name.includes('.') ? name.split('.').pop() : ''

  const mimeTypes = {
    images: ['.png', '.jpg', '.jpeg', '.tiff', '.gif'],
    text: ['.txt', '.md'],
    pdf: ['.pdf'],
    html: ['.html', '.htm', '.php'],
    video: ['.mp4', '.mpg', '.mpeg', '.ogg', '.mkv']
  }

  function getPreviewUrl (entry, basePath) {
    if (entry.isDirectory) return '/img/directory.png'
    if (mimeTypes.images.some(e => entry.filePath.toLowerCase().endsWith(e))) return sanitize('/files' + basePath + '/' + entry.filePath)
    if (mimeTypes.text.some(e => entry.filePath.toLowerCase().endsWith(e))) return '/img/text.png'
    if (mimeTypes.pdf.some(e => entry.filePath.toLowerCase().endsWith(e))) return '/img/pdf.png'
    if (mimeTypes.html.some(e => entry.filePath.toLowerCase().endsWith(e))) return '/img/html.png'
    if (mimeTypes.video.some(e => entry.filePath.toLowerCase().endsWith(e))) return '/img/video.png'
    return '/img/unknown.png'
  }

  Vue.filter('prettyDate', (value) => {
    const d = new Date(value)
    return d.toDateString()
  })

  Vue.filter('prettyFileSize', (value) => {
    return filesize(value)
  })

  window.app = new Vue({
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
      entries: [],
      sortBy: 'name',
      sortOrder: 1,
      dragCounter: {}
    },
    computed: {
      sortedEntries: function () {
        if (this.sortBy === 'name') {
          return this.entries.slice().sort((a, b) => (a.filePath < b.filePath) ? -this.sortOrder : (a.filePath > b.filePath) ? this.sortOrder : 0)
        } else if (this.sortBy === 'size') {
          return this.entries.slice().sort((a, b) => (a.size - b.size) * this.sortOrder)
        } else if (this.sortBy === 'date') {
          return this.entries.slice().sort((a, b) => (a.mtime < b.mtime) ? -this.sortOrder : (a.mtime > b.mtime) ? this.sortOrder : 0)
        } else if (this.sortBy === 'type') {
          return this.entries.slice().sort((a, b) => {
            const extA = getExt(a.filePath)
            const extB = getExt(b.filePath)
            return (extA < extB) ? -this.sortOrder : (extA > extB) ? this.sortOrder : 0
          })
        }
      }
    },
    created () {
      $('#modalDelete').on('shown.bs.modal', () => $('#deleteNoBtn').focus())

      $('#modalcreateDirectory').on('shown.bs.modal', () => $('#inputDirectoryName').focus())

      $('#modalRename').on('shown.bs.modal', () => $('#inputRename').select())

      $(window).on('dragend', () => this.resetDrag())

      this.loadDirectory(window.location.hash.slice(1))

      $(window).on('hashchange', () => this.loadDirectory(window.location.hash.slice(1)))
    },
    methods: {
      prettyFileSize: filesize,
      logout () {
        window.location.href = '/logout'
      },
      loadDirectory (filePath) {
        this.resetDrag()
        this.busy = true

        filePath = filePath ? sanitize(filePath) : '/'

        superagent.get('/api/files/' + filePath)
          .end((error, result) => {
            this.busy = false

            if (result && result.statusCode === 401) return this.logout()
            if (error) return console.error(error)

            result.body.entries.sort((a, b) => a.isDirectory && b.isFile ? -1 : 1)
            this.entries = result.body.entries.map((entry) => {
              entry.previewUrl = getPreviewUrl(entry, filePath)
              return entry
            })
            this.path = filePath
            this.pathParts = decode(filePath)
              .replace(/^\//, '')
              .split('/')
              .map((e, i, a) => ({
                name: e,
                link: '#' + sanitize('/' + a.slice(0, i).join('/') + '/' + e)
              }))

            // update in case this was triggered from code
            window.location.hash = this.path

            Vue.nextTick(() => {
              $(() => {
                $('[data-toggle="tooltip"]').tooltip()
              })
            })
          })
      },
      getUrl (entry) {
        const path = sanitize(this.path + '/' + entry.filePath)
        if (entry.isDirectory) return '#' + path
        else return '/files' + path
      },
      up () {
        window.location.hash = sanitize(this.path.split('/').slice(0, -1).filter(p => !!p).join('/'))
      },
      upload () {
        $(this.$refs.upload).on('change', () => {
          this.busy = true

          // detach event handler
          $(this.$refs.upload).off('change')

          const length = this.$refs.upload.files.length
          let done = 0

          const uploadFile = (file) => {
            const path = sanitize(this.path + '/' + encode(file.name))

            const formData = new FormData()
            formData.append('file', file)

            superagent.put('/api/files' + path)
              .send(formData)
              .end((error, result) => {
                if (result && result.statusCode === 401) return this.logout()
                if (result && result.statusCode !== 201) console.error('Error uploading file: ', result.statusCode)
                if (error) console.error(error)

                done++

                if (done >= length) {
                  this.busy = false
                  this.refresh()
                }
              })
          }

          for (let i = 0; i < length; i++) {
            uploadFile(this.$refs.upload.files[i])
          }
        })

        // reset the form first to make the change handler retrigger even on the same file selected
        $('#fileUploadForm')[0].reset()

        this.$refs.upload.click()
      },
      delAsk (entry) {
        $('#modalDelete').modal('show')
        this.deleteData = entry
      },
      del (entry) {
        this.busy = true

        const path = sanitize(this.path + '/' + encode(entry.filePath))

        superagent.del('/api/files' + path)
          .query({
            recursive: true
          })
          .end((error, result) => {
            this.busy = false

            if (result && result.statusCode === 401) return this.logout()
            if (result && result.statusCode !== 200) return console.error('Error deleting file: ', result.statusCode)
            if (error) return console.error(error)

            this.refresh()

            $('#modalDelete').modal('hide')
          })
      },
      open (entry) {
        const path = sanitize(this.path + '/' + entry.filePath)
        if (entry.isDirectory) {
          window.location.hash = path
        } else {
          window.location.href = '/files' + path
        }
      },
      refresh () {
        this.loadDirectory(this.path)
      },
      createDirectoryAsk () {
        $('#modalcreateDirectory').modal('show')
        this.createDirectoryData = ''
        this.createDirectoryError = null
      },
      createDirectory (name) {
        this.busy = true
        this.createDirectoryError = null

        const path = sanitize(this.path + '/' + encode(name))

        superagent.put('/api/files' + path)
          .query({
            directory: true
          })
          .end((error, result) => {
            this.busy = false

            if (result && result.statusCode === 401) return this.logout()
            if (result && result.statusCode === 403) {
              this.createDirectoryError = 'Name not allowed'
              return
            }
            if (result && result.statusCode === 409) {
              this.createDirectoryError = 'Directory already exists'
              return
            }
            if (result && result.statusCode !== 201) return console.error('Error creating directory: ', result.statusCode)
            if (error) return console.error(error)

            this.createDirectoryData = ''
            this.refresh()

            $('#modalcreateDirectory').modal('hide')
          })
      },
      renameAsk (entry) {
        $('#modalRename').modal('show')
        this.renameOld = entry.filePath
        this.renameNew = this.renameOld
        this.renameError = null
      },
      rename (oldName, newName) {
        this.renameError = null

        const oldPath = sanitize(this.path + '/' + encode(oldName))
        const newPath = sanitize(this.path + '/' + encode(newName))

        this.move(oldPath, newPath, (error) => {
          if (error) {
            this.renameError = error
            return
          }
          this.renameOld = ''
          this.renameNew = ''
          this.refresh()
          $('#modalRename').modal('hide')
        })
      },
      move (oldPath, newPath, callback) {
        this.busy = true

        superagent.put('/api/files' + newPath)
          .query({
            from: decode(oldPath)
          })
          .end((error, result) => {
            this.busy = false

            if (result && result.statusCode === 401) {
              callback('Unauthorized')
              return this.logout()
            }
            if (result && result.statusCode === 403) return callback('Name not allowed')
            if (result && result.statusCode === 409) return callback('Already exists')
            if (result && result.statusCode !== 201) return callback('Error moving file: ', result.statusCode)
            if (error) return callback(error.toString())
            callback()
          })
      },
      onDrag (event, entry) {
        event.dataTransfer.setData('text', entry.filePath)
      },
      shouldAllowDrop (event, entry) {
        if (entry === '..' || entry.isDirectory) event.preventDefault() // Allow drop only on directories
      },
      onDrop (event, entry) {
        if (!(entry === '..' || entry.isDirectory)) throw new Error('Trying to move to another file') // just to be safe
        const origin = event.dataTransfer.getData('text')
        if (origin === entry.filePath) return
        const originPath = sanitize(this.path + '/' + encode(origin))
        const destinationDir = entry === '..'
          ? this.path.replace(/\/$/, '').split('/').slice(0, -1).join('/') + '/' // removing last leaf from current path
          : this.path + '/' + encode(entry.filePath) // Adding dir name to current path
        const destinationPath = sanitize(destinationDir + '/' + encode(origin))

        this.move(originPath, destinationPath, (error) => {
          if (error) return console.error(error)
          this.refresh()
        })
      },
      onDragEnter (event, entry) {
        if (entry === '..' || entry.isDirectory) {
          const name = (entry === '..') ? '..' : entry.filePath
          this.dragCounter[name] = (this.dragCounter[name] || 0) + 1
          if (event.target.tagName === 'TR') $(event.target).addClass('dragged-over')
          else $(event.target).parent('tr').addClass('dragged-over')
        }
      },
      onDragLeave (event, entry) {
        if (entry === '..' || entry.isDirectory) {
          const name = (entry === '..') ? '..' : entry.filePath
          this.dragCounter[name] = this.dragCounter[name] - 1
          if (this.dragCounter[name] <= 0) {
            this.dragCounter[name] = 0
            if (event.target.tagName === 'TR') $(event.target).removeClass('dragged-over')
            else $(event.target).parent('tr').removeClass('dragged-over')
          }
        }
      },
      resetDrag () {
        $('tr').removeClass('dragged-over')
        this.dragCounter = {}
      },
      selectSort (type) {
        if (this.sortBy === type) this.sortOrder *= -1
        else this.sortBy = type
      }
    }
  })
})()
