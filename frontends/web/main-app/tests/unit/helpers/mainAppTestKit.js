const fs = require('node:fs')
const path = require('node:path')

const mainAppRoot = path.resolve(__dirname, '..', '..', '..')
const testsUnitSrcRoot = path.join(mainAppRoot, 'tests', 'unit', 'src')
const srcRoot = path.join(mainAppRoot, 'src')

let unregisterTypescript = null

function resolveMirroredRelativeDir(testFilePath) {
  return path.relative(testsUnitSrcRoot, path.dirname(testFilePath))
}

function resolveMirroredSrcPath(testFilePath, relativePath = '.') {
  return path.resolve(srcRoot, resolveMirroredRelativeDir(testFilePath), relativePath)
}

function readMirroredSrcFile(testFilePath, relativePath) {
  return fs.readFileSync(resolveMirroredSrcPath(testFilePath, relativePath), 'utf8')
}

function readRootFile(relativePath) {
  return fs.readFileSync(path.join(mainAppRoot, relativePath), 'utf8')
}

function registerTypescriptRequire() {
  if (unregisterTypescript) {
    return unregisterTypescript
  }

  const ts = require('typescript')
  const previousTs = require.extensions['.ts']
  const previousTsx = require.extensions['.tsx']

  function compileTypescript(module, filename) {
    const source = fs.readFileSync(filename, 'utf8')
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
      },
      fileName: filename,
    })
    module._compile(output.outputText, filename)
  }

  require.extensions['.ts'] = compileTypescript
  require.extensions['.tsx'] = compileTypescript

  unregisterTypescript = () => {
    if (previousTs) {
      require.extensions['.ts'] = previousTs
    } else {
      delete require.extensions['.ts']
    }

    if (previousTsx) {
      require.extensions['.tsx'] = previousTsx
    } else {
      delete require.extensions['.tsx']
    }

    unregisterTypescript = null
  }

  return unregisterTypescript
}

function clearModuleCache(prefix) {
  Object.keys(require.cache).forEach((modulePath) => {
    if (modulePath.startsWith(prefix)) {
      delete require.cache[modulePath]
    }
  })
}

function clearMirroredSrcModuleCache(testFilePath, relativePrefix = '.') {
  clearModuleCache(resolveMirroredSrcPath(testFilePath, relativePrefix))
}

function requireMirroredSrcModule(testFilePath, relativePath) {
  return require(resolveMirroredSrcPath(testFilePath, relativePath))
}

module.exports = {
  clearMirroredSrcModuleCache,
  mainAppRoot,
  readMirroredSrcFile,
  readRootFile,
  registerTypescriptRequire,
  requireMirroredSrcModule,
  resolveMirroredSrcPath,
  srcRoot,
}
