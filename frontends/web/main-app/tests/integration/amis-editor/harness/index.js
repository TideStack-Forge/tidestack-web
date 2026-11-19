import React from 'react'
import { createRoot } from 'react-dom/client'
import editorCss from 'amis-editor-core/lib/style.css'
import 'amis/lib/renderers/Page'
import 'amis/lib/renderers/Tpl'
import 'amis/lib/renderers/Action'
import 'ouroboros-amis-runtime/renderers/patch/Form'
import 'ouroboros-amis-runtime/renderers/OuroborosDialog'
import 'ouroboros-amis-runtime/renderers/OuroborosDrawer'
import { Editor } from 'ouroboros-amis-runtime/renderers/LazyAmisEditor'
import { getPureSchema } from 'ouroboros-amis-runtime/editor/utils/pureSchema'

const style = document.createElement('style')
style.textContent = editorCss
document.head.appendChild(style)
document.getElementById('root').style.height = '900px'
let root
window.editorHarness = {
  changes: [],
  manager: null,
  open(value) {
    root?.unmount()
    root = createRoot(document.getElementById('root'))
    this.manager = null
    this.changes = []
    root.render(
      React.createElement(Editor, {
        value,
        autoFocus: true,
        appLocale: 'zh-CN',
        theme: 'cxd',
        onEditorMount: (manager) => {
          this.manager = manager
        },
        onChange: (schema) => this.changes.push(getPureSchema(schema)),
        amisEnv: { notify: () => undefined, confirm: () => Promise.resolve(true) },
      })
    )
  },
}
