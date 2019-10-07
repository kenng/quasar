const
  fs = require('fs'),
  path = require('path'),
  compileTemplate = require('lodash.template')

const
  log = require('./helpers/logger')('app:generator')
  appPaths = require('./app-paths'),
  quasarFolder = appPaths.resolve.app('.quasar')

class Generator {
  constructor (quasarConfig) {
    const { ctx, preFetch, ...cfg } = quasarConfig.getBuildConfig()

    let paths = []
    this.files = []

    this.alreadyGenerated = false
    this.quasarConfig = quasarConfig

    if (cfg.multiEntry) {
      let entries = cfg.multiEntry
      for (const key in entries) {
        const entry = entries[key]
        const dest = entry.dest,
              sourceFiles = entry.sourceFiles,
              dir = entry.dir,
              content = fs.readFileSync(
                  appPaths.resolve.cli(`templates/entry/app.js`),
                  'utf-8'
                )

        this.files.push({
          filename: dest,
          dest: path.join(quasarFolder, dest),
          template: compileTemplate(content),
          sourceFiles
        })
      }
    }

    if (!cfg.noDefaultEntry) paths.push('app.js')
    paths.push('client-entry.js', 'import-quasar.js')

    if (preFetch) {
      paths.push('client-prefetch.js')
    }
    if (ctx.mode.ssr) {
      paths.push('server-entry.js')
    }

    for (let file of paths) {
        const filename = path.basename(file)
        const content = fs.readFileSync(
              appPaths.resolve.cli(`templates/entry/${file}`),
              'utf-8'
            )

        this.files.push({
            filename,
            dest: path.join(quasarFolder, filename),
            template: compileTemplate(content)
        })
    }
  }

  build () {
    log(`Generating Webpack entry point`)
    const data = this.quasarConfig.getBuildConfig()

    // ensure .quasar folder
    if (!fs.existsSync(quasarFolder)) {
      fs.mkdirSync(quasarFolder)
    }
    else if (!fs.lstatSync(quasarFolder).isDirectory()) {
      const { removeSync } = require('fs-extra')
      removeSync(quasarFolder)
      fs.mkdirSync(quasarFolder)
    }

    this.files.forEach(file => {
      if (file.sourceFiles) data.sourceFiles = file.sourceFiles
      if (file.boot) data.boot = file.boot
      fs.writeFileSync(file.dest, file.template(data), 'utf-8')
    })

    if (!this.alreadyGenerated) {
      const then = Date.now() / 1000 - 120

      this.files.forEach(file => {
        fs.utimes(file.dest, then, then, function (err) { if (err) throw err })
      })

      this.alreadyGenerated = true
    }
  }
}

module.exports = Generator
