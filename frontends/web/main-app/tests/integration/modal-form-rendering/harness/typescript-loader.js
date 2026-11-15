const ts = require('typescript')

module.exports = function compile(source) {
  return ts.transpileModule(source, {
    fileName: this.resourcePath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2019,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      experimentalDecorators: true,
      esModuleInterop: true,
    },
  }).outputText
}
