const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const webpack = require('webpack')

async function startHarness(options = {}) {
  const outputPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ouroboros-modal-rendering-'))
  const mainAppRoot = path.resolve(__dirname, '../../../..')
  const compiler = webpack({
    mode: 'production',
    entry: options.entry || path.join(__dirname, 'index.js'),
    output: { path: outputPath, filename: 'bundle.js' },
    devtool: false,
    optimization: { minimize: false },
    performance: false,
    resolve: {
      extensions: ['.js', '.json', '.ts', '.tsx'],
      alias: {
        amis$: path.join(__dirname, 'amis.js'),
        '@/common/i18n/amis$': path.join(__dirname, 'environment.js'),
        '@/common/eventBus$': path.join(__dirname, 'environment.js'),
        '@/router/utils$': path.join(__dirname, 'environment.js'),
        '@/common/modal$': path.join(__dirname, 'environment.js'),
        '@/store/storeFacade$': path.join(__dirname, 'environment.js'),
        ...options.alias,
        '@': path.join(mainAppRoot, 'src'),
      },
      modules: [path.join(mainAppRoot, 'node_modules'), 'node_modules'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: path.join(__dirname, 'typescript-loader.js'),
        },
        { test: /\.(css|scss|less|svg|png|jpg|woff2?|ttf|eot)$/, type: 'asset/source' },
      ],
    },
  })
  try {
    await new Promise((resolve, reject) =>
      compiler.run((error, stats) => {
        if (error || stats.hasErrors()) {
          reject(error || new Error(stats.toString({ all: false, errors: true })))
        } else {
          resolve()
        }
      })
    )
  } finally {
    await new Promise((resolve, reject) =>
      compiler.close((error) => (error ? reject(error) : resolve()))
    )
  }
  const scripts = new Map(fs.readdirSync(outputPath).filter(name => name.endsWith('.js')).map(name => [name, fs.readFileSync(path.join(outputPath, name))]))
  fs.rmSync(outputPath, { recursive: true })
  const theme = fs.readFileSync(require.resolve('amis/lib/themes/cxd.css'))
  const server = http.createServer((request, response) => {
    if (scripts.has(request.url.slice(1))) {
      response.setHeader('Content-Type', 'text/javascript')
      response.end(scripts.get(request.url.slice(1)))
    } else if (request.url === '/theme.css') {
      response.setHeader('Content-Type', 'text/css')
      response.end(theme)
    } else {
      response.setHeader('Content-Type', 'text/html; charset=utf-8')
      response.end(
        '<!doctype html><link rel="stylesheet" href="/theme.css"><div id="root"></div><script src="/bundle.js"></script>'
      )
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      ),
  }
}

module.exports = { startHarness }
