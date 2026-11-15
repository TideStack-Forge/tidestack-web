const webpack = require('webpack')
const WebpackDevServer = require('webpack-dev-server')

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

const createConfig = require('../webpack.config')

async function start() {
  const config = createConfig({}, { mode: process.env.NODE_ENV })
  const compiler = webpack(config)
  const server = new WebpackDevServer(config.devServer || {}, compiler)

  const shutdown = async () => {
    await server.stop()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await server.start()
}

start().catch((error) => {
  console.error(error)
  process.exit(1)
})
