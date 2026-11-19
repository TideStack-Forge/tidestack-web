const path = require('path')
const fs = require('fs')
const { createHostBindings } = require('../ouroboros-amis-runtime/host-bindings.cjs')
const amisHostBindings = createHostBindings(Object.fromEntries(
  require('../ouroboros-amis-runtime/host-ports.json').map((port) => [port, path.resolve(__dirname, 'src', port)])
))
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
const HtmlWebpackDeployPlugin = require('html-webpack-deploy-plugin')
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin')
const MonacoChinesePlugin = require('monaco-editor-chinese-plugin')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')

const { createRuntimeOptions, resolve } = require('./webpack.runtime')

const ICON_PICKER_DATA_RESOURCE_PATTERN =
  /[\\/]ouroboros-amis-runtime[\\/]src[\\/]renderers[\\/]icon-data[\\/]/

function resolveSharedPackagePath(packageName) {
  const localPath = path.join(__dirname, 'node_modules', packageName)
  if (fs.existsSync(localPath)) {
    return localPath
  }

  const worktreeMarker = `${path.sep}.worktrees${path.sep}`
  const markerIndex = __dirname.indexOf(worktreeMarker)
  if (markerIndex < 0) {
    return localPath
  }

  const repoRoot = __dirname.substring(0, markerIndex)
  const worktreeRelative = __dirname.substring(markerIndex + worktreeMarker.length)
  const [, ...repoRelativeSegments] = worktreeRelative.split(path.sep)
  const sharedPath = path.join(
    repoRoot,
    ...repoRelativeSegments,
    'node_modules',
    packageName
  )
  if (fs.existsSync(sharedPath)) {
    return sharedPath
  }

  return localPath
}

function resolveNodeModulesRoots() {
  const roots = [path.join(__dirname, 'node_modules')]
  const worktreeMarker = `${path.sep}.worktrees${path.sep}`
  const markerIndex = __dirname.indexOf(worktreeMarker)
  if (markerIndex >= 0) {
    const repoRoot = __dirname.substring(0, markerIndex)
    const worktreeRelative = __dirname.substring(markerIndex + worktreeMarker.length)
    const [, ...repoRelativeSegments] = worktreeRelative.split(path.sep)
    roots.push(path.join(repoRoot, ...repoRelativeSegments, 'node_modules'))
  }
  roots.push(path.join(__dirname, '..', 'node_modules'))
  roots.push(path.join(__dirname, '..', '..', 'node_modules'))
  return Array.from(new Set(roots))
}

module.exports = (_env = {}, argv = {}) => {
  void _env
  const mode = argv.mode || process.env.NODE_ENV || 'development'
  const isProd = mode === 'production'
  const runtime = createRuntimeOptions(process.argv)
  const outputPath = runtime.outputDir
  const definedEnv = Object.keys(process.env)
    .filter(
      (key) => key === 'NODE_ENV' || key === 'BASE_URL' || key.startsWith('VUE_APP_')
    )
    .reduce(
      (result, key) => {
        result[`process.env.${key}`] = JSON.stringify(process.env[key])
        return result
      },
      {
        'process.env.NODE_ENV': JSON.stringify(mode),
        'process.env.BASE_URL': JSON.stringify(runtime.publicPath),
        'process.env.PLAYWRIGHT_HARNESS': JSON.stringify(
          runtime.isPlaywrightHarness ? 'true' : 'false'
        ),
      }
    )

  if (mode === 'development') {
    console.warn(
      `测试服务器后端地址: ${runtime.apiBackendUrl}, ${runtime.wsBackendUrl}\n`
    )
    console.warn(`开发平台调试控制台微前端地址: ${runtime.debugConsoleMicroWeb}\n`)
    console.warn(`逻辑流程编辑器微前端地址: ${runtime.logicflowEditorMicroWeb}\n`)
    console.warn(`工作流编辑器微前端地址: ${runtime.workflowEditorMicroWeb}\n`)
    console.warn(`其他微前端地址: ${runtime.otherMicroWeb}\n`)
    Object.entries(runtime.microWebProxyMap).forEach(([context, target]) => {
      console.warn(`微前端代理映射: ${context} -> ${target}\n`)
    })
  }

  const entries = Object.fromEntries(
    Object.entries(runtime.pages).map(([name, page]) => [name, resolve(page.entry)])
  )
  const nodeModulesRoots = resolveNodeModulesRoots()
  const historyApiFallbackRewrites = runtime.pages.debug
    ? [
        {
          from: /^\/debug(?:\/.*)?$/,
          to: '/debug.html',
        },
      ]
    : []

  const plugins = [
    // Inline compiler source maps inflate the worker and slow its startup.
    // Keep application debugging, without embedding vendor compiler source maps.
    ...(!isProd
      ? [
          new webpack.EvalSourceMapDevToolPlugin({
            columns: false,
            module: true,
            exclude:
              /[\\/]monaco-editor[\\/]esm[\\/]vs[\\/]language[\\/]typescript[\\/]lib[\\/]/,
          }),
        ]
      : []),
    new webpack.IgnorePlugin({
      checkResource(resource, context) {
        return (
          (resource === './locale' && /moment$/.test(context || '')) ||
          (resource === './schema.json' && /amis$/.test(context || ''))
        )
      },
    }),
    new webpack.DefinePlugin(definedEnv),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: resolve('public'),
          to: outputPath,
          globOptions: {
            ignore: ['**/index.html'],
          },
          noErrorOnMissing: true,
        },
      ],
    }),
    ...Object.entries(runtime.pages).map(
      ([name, page]) =>
        new HtmlWebpackPlugin({
          chunks: [name],
          template: resolve(page.template),
          filename: page.filename,
          title: page.title,
          inject: page.inject,
          templateParameters: (compilation, assets, assetTags, options) => ({
            compilation,
            webpackConfig: compilation.options,
            htmlWebpackPlugin: {
              tags: assetTags,
              files: assets,
              options,
            },
            BASE_URL: runtime.publicPath,
          }),
        })
    ),
    new HtmlWebpackDeployPlugin({
      findNodeModulesPath: (_cwd, packageName) => resolveSharedPackagePath(packageName),
      packages: {
        react: {
          copy: isProd
            ? [
                {
                  from: 'umd/react.production.min.js',
                  to: 'react.production.min.js',
                },
              ]
            : [{ from: 'umd/react.development.js', to: 'react.development.js' }],
          scripts: {
            variableName: 'React',
            path: isProd ? 'react.production.min.js' : 'react.development.js',
            cdnPath: isProd ? 'umd/react.production.min.js' : 'umd/react.development.js',
          },
        },
        'react-dom': {
          copy: isProd
            ? [
                {
                  from: 'umd/react-dom.production.min.js',
                  to: 'react-dom.production.min.js',
                },
              ]
            : [
                {
                  from: 'umd/react-dom.development.js',
                  to: 'react-dom.development.js',
                },
              ],
          scripts: {
            variableName: 'ReactDOM',
            path: isProd ? 'react-dom.production.min.js' : 'react-dom.development.js',
            cdnPath: isProd
              ? 'umd/react-dom.production.min.js'
              : 'umd/react-dom.development.js',
          },
        },
      },
      useCdn: false,
      getCdnPath: (packageName, packageVersion, packagePath) =>
        `//unpkg.zhimg.com/${packageName}@${packageVersion}/${packagePath}`,
    }),
    new MonacoWebpackPlugin({
      filename: 'static/monaco/[name].worker.js',
    }),
    new MonacoChinesePlugin(),
    new MiniCssExtractPlugin({
      filename: 'static/css/[name].[contenthash:4].css',
      chunkFilename: 'static/css/[name].[contenthash:4].css',
    }),
  ]

  if (runtime.argsMap.report) {
    plugins.push(new BundleAnalyzerPlugin())
  }

  return {
    mode,
    target: 'web',
    context: __dirname,
    entry: entries,
    output: {
      path: outputPath,
      publicPath: runtime.publicPath,
      filename: 'static/js/[name].[contenthash:4].js',
      chunkFilename: 'static/js/[name].[contenthash:4].js',
      assetModuleFilename: 'static/assets/[name].[contenthash:4][ext][query]',
      hashDigestLength: 4,
      clean: true,
    },
    devtool: false,
    stats: 'errors-warnings',
    resolve: {
      alias: {
        ...amisHostBindings,
        'ouroboros-amis-runtime': path.resolve(__dirname, '../ouroboros-amis-runtime/src'),
        '@': resolve('src'),
        'amis-core': resolveSharedPackagePath('amis-core'),
        'entities/lib/maps/entities.json': resolve('src/compat/markdownItEntities.js'),
      },
      modules: nodeModulesRoots,
      extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
      conditionNames: ['require', 'browser', '...'],
      fallback: {
        url: require.resolve('url'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        path: require.resolve('path-browserify'),
        stream: require.resolve('stream-browserify'),
        assert: require.resolve('assert'),
      },
    },
    resolveLoader: {
      modules: nodeModulesRoots,
    },
    module: {
      rules: [
        {
          test: /\.m?js$/,
          resolve: {
            fullySpecified: false,
          },
        },
        {
          test: /\.(m?js|jsx|ts|tsx)$/,
          exclude: isProd ? undefined : /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
            },
          },
        },
        {
          test: /\.css$/,
          use: [
            isProd ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: [require('autoprefixer')],
                },
              },
            },
          ],
        },
        {
          test: /\.(scss|sass)$/,
          use: [
            isProd ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: [require('autoprefixer')],
                },
              },
            },
            'sass-loader',
          ],
        },
        {
          test: /\.svg$/,
          include: [resolve('src/icons')],
          use: [
            {
              loader: 'svg-sprite-loader',
              options: {
                symbolId: (filePath) => {
                  const dirName = path.dirname(filePath).split(path.sep).pop()
                  const prefix = dirName === 'svg' ? '' : `${dirName}-`
                  const name = path.basename(filePath).replace(/\.svg$/, '')
                  return `icon-${prefix}${name}`
                },
              },
            },
          ],
        },
        {
          test: /\.svg$/,
          exclude: [resolve('src/icons')],
          type: 'asset/resource',
        },
        {
          test: /\.(png|jpe?g|gif|webp|avif|bmp|ico)$/,
          type: 'asset/resource',
        },
        {
          test: /\.(woff2?|eot|ttf|otf)$/,
          type: 'asset/resource',
        },
        {
          test: /\.(mp4|mp3|wav|ogg|pdf|wasm)$/,
          type: 'asset/resource',
        },
      ],
    },
    plugins,
    optimization: {
      minimize: isProd,
      realContentHash: false,
      minimizer: ['...', new CssMinimizerPlugin()],
      splitChunks: {
        chunks: 'all',
        minSize: 30000,
        minChunks: 1,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        enforceSizeThreshold: 500000,
        cacheGroups: {
          iconPickerFontAwesome: {
            name: 'icon-picker-fontawesome-6',
            test: /[\\/]ouroboros-amis-runtime[\\/]src[\\/]renderers[\\/]icon-data[\\/]FontAwesome 6\.x\.json$/,
            chunks: 'async',
            priority: 1000,
            enforce: true,
          },
          iconPickerInternal: {
            name: 'icon-picker-internal',
            test: /[\\/]ouroboros-amis-runtime[\\/]src[\\/]renderers[\\/]icon-data[\\/]internal\.json$/,
            chunks: 'async',
            priority: 1000,
            enforce: true,
          },
          default: {
            test: /[\\/]node_modules[\\/]/,
            priority: 1,
            name: 'vendors',
            minChunks: 1,
            reuseExistingChunk: true,
            enforce: true,
            chunks: 'all',
          },
          mothership: {
            name: 'mothership',
            test: (module) => {
              const resource = module.nameForCondition?.() || module.resource || ''
              return !ICON_PICKER_DATA_RESOURCE_PATTERN.test(resource)
            },
            reuseExistingChunk: true,
            priority: -1,
          },
          monaco: {
            name: 'monaco',
            test: /[\\/]node_modules[\\/](monaco-editor)(.*)/,
            reuseExistingChunk: true,
            priority: 999,
          },
          codemirror: {
            name: 'codemirror',
            test: /[\\/]node_modules[\\/](codemirror)(.*)/,
            reuseExistingChunk: true,
            priority: 999,
          },
          echarts: {
            name: 'echarts',
            test: /[\\/]node_modules[\\/](echarts|zrender)(.*)/,
            reuseExistingChunk: true,
            priority: 999,
          },
          tinymce: {
            name: 'tinymce',
            test: (module) => {
              const resource = module.resource || ''
              const result = /[\\/]node_modules[\\/].*([tT]inymce)(.*)/.test(resource)
              if (result && resource.includes('renderers')) {
                return false
              }
              return result
            },
            reuseExistingChunk: true,
            priority: 999,
          },
          froalaEditor: {
            name: 'froala-editor',
            test: (module) => {
              const resource = module.resource || ''
              const result =
                /[\\/]node_modules[\\/]froala-editor.*/.test(resource) ||
                resource.includes('amis-ui/lib/components/RichText')
              if (result && resource.includes('renderers')) {
                return false
              }
              return result
            },
            reuseExistingChunk: true,
            priority: 999,
          },
          officeViewer: {
            name: 'office-viewer',
            test: /[\\/]node_modules[\\/](office-viewer)(.*)/,
            reuseExistingChunk: true,
            priority: 999,
          },
          mpegtsJs: {
            name: 'mpegts-js',
            test: /[\\/]node_modules[\\/](mpegts.js)(.*)/,
            reuseExistingChunk: true,
            priority: 999,
          },
          hlsJs: {
            name: 'hls-js',
            test: /[\\/]node_modules[\\/](hls.js)(.*)/,
            reuseExistingChunk: true,
            priority: 999,
          },
          exceljsXlsx: {
            name: 'exceljs-xlsx',
            test: /[\\/]node_modules[\\/](exceljs|xlsx)(.*)/,
            reuseExistingChunk: true,
            priority: 999,
          },
          pdfComponent: {
            name: 'pdf-component',
            test: (module) => {
              const resource = module.resource || ''
              const result = /[\\/]node_modules[\\/].*[pP]df.*/.test(resource)
              if (result && resource.includes('renderers')) {
                return false
              }
              return result
            },
            reuseExistingChunk: true,
            priority: 999,
          },
          markdownComponent: {
            name: 'markdown-component',
            test: (module) => {
              const resource = module.resource || ''
              const result = /[\\/]node_modules[\\/].*[Mm]arkdown.*/.test(resource)
              if (result && resource.includes('renderers')) {
                return false
              }
              return result
            },
            reuseExistingChunk: true,
            priority: 999,
          },
          react: {
            name: 'react-bundle',
            test: /[\\/]node_modules[\\/](.*react|mobx|redux|@?rc-|react|rc-|i18n-runtime).*/,
            reuseExistingChunk: true,
            priority: 80,
          },
          amis: {
            name: 'amis',
            test: /[\\/]node_modules[\\/](amis).*/,
            maxSize: 4000000,
            minSize: 2000000,
            priority: 90,
            reuseExistingChunk: true,
          },
          amisUi: {
            name: 'amis-ui',
            test: /[\\/]node_modules[\\/](amis-ui).*/,
            maxSize: 2000000,
            minSize: 1500000,
            priority: 91,
            reuseExistingChunk: true,
          },
          amisStyle: {
            name: 'amis-style',
            test: /[\\/]node_modules[\\/](.*amis).*\.css/,
            reuseExistingChunk: true,
            priority: 92,
          },
          amisEditor: {
            name: 'amis-editor',
            test: /[\\/]node_modules[\\/](amis-editor|json-ast-comments|amis-theme-editor-helper).*/,
            priority: 100,
            reuseExistingChunk: true,
          },
          amisEditorStyle: {
            test: /[\\/]node_modules[\\/]amis-editor.*css/,
            priority: 101,
            name: 'amis-editor-style',
            minChunks: 1,
            reuseExistingChunk: true,
            enforce: true,
          },
        },
      },
    },
    performance: {
      hints: false,
    },
    devServer: {
      host: runtime.devServerHost,
      port: runtime.devServerPort,
      hot: true,
      historyApiFallback: {
        disableDotRule: true,
        index: '/index.html',
        rewrites: historyApiFallbackRewrites,
      },
      static: {
        directory: resolve('public'),
        publicPath: runtime.publicPath,
        watch: true,
      },
      proxy: [
        {
          context: ['/api/', '/oauth2/', '/.well-known/', '/userinfo', '/connect/logout'],
          target: runtime.apiBackendUrl,
        },
        {
          context: ['/websocket/'],
          target: runtime.wsBackendUrl,
          ws: !runtime.isPlaywrightHarness,
          changeOrigin: true,
        },
        ...Object.entries(runtime.microWebProxyMap).map(([context, target]) => ({
          context: [context],
          target,
        })),
      ],
      client: {
        progress: true,
        overlay: {
          warnings: false,
          errors: false,
          runtimeErrors: false,
        },
        reconnect: true,
      },
    },
  }
}
