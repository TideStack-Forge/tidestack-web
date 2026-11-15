const webpack = require('webpack')

process.env.NODE_ENV = process.env.NODE_ENV || 'production'

const createConfig = require('../webpack.config')

const compiler = webpack(createConfig({}, { mode: process.env.NODE_ENV }))

compiler.run((error, stats) => {
  if (error) {
    console.error(error)
    process.exitCode = 1
    return
  }

  if (!stats) {
    process.exitCode = 1
    return
  }

  process.stdout.write(
    `${stats.toString({
      colors: true,
      chunks: false,
      modules: false,
      children: false,
    })}\n`
  )

  compiler.close(() => {
    if (stats.hasErrors()) {
      process.exitCode = 1
    }
  })
})
