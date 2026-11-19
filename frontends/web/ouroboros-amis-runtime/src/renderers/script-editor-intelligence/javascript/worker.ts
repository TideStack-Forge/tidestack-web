/** This worker has ECMAScript libraries only; frontend Monaco defaults remain independent. */
const workers = new WeakMap<object, { client: any; references: number }>()

export function acquireBackendJavascriptWorker(monaco: any) {
  let entry = workers.get(monaco)
  if (!entry) {
    entry = {
      client: monaco.editor.createWebWorker({
        moduleId: 'vs/language/typescript/tsWorker',
        label: 'javascript',
        keepIdleModels: true,
        createData: {
          compilerOptions: {
            target: monaco.languages.typescript.ScriptTarget.ES2020,
            lib: ['lib.es2020.d.ts'],
            allowNonTsExtensions: true,
            allowJs: true,
            checkJs: true,
            noEmit: true,
          },
          extraLibs: {},
          inlayHintsOptions: {},
        },
      }),
      references: 0,
    }
    workers.set(monaco, entry)
  }
  entry.references++
  const owned = entry
  let released = false
  return {
    async at(uri: any) {
      return owned.client.withSyncedResources([uri])
    },
    dispose() {
      if (released) return
      released = true
      if (--owned.references === 0) {
        workers.delete(monaco)
        owned.client.dispose()
      }
    },
  }
}
