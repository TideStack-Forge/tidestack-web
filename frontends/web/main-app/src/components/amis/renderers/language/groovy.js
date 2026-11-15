import { registerTextmateGroovyLanguage } from '../script-editor-intelligence/groovy/registerTextmate'

const wordPattern = /(-?\d*\.\d\w*)|([^`~!@#%^&*()\-=+[{\]}\\|;:'",./?\s]+)/g

const brackets = [
  ['{', '}'],
  ['[', ']'],
  ['(', ')'],
]

const autoClosingPairs = [
  { open: '{', close: '}' },
  { open: '[', close: ']' },
  { open: '(', close: ')' },
  { open: '"', close: '"' },
  { open: "'", close: "'" },
  { open: '`', close: '`' },
]

const surroundingPairs = autoClosingPairs

const id = 'groovy'
const label = 'Groovy'

export default (monaco, editor) => {
  const { languages } = monaco
  languages?.register({ id, aliases: [label] })
  languages?.setLanguageConfiguration?.(id, {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/'],
    },
    brackets,
    autoClosingPairs,
    surroundingPairs,
    wordPattern,
  })
  registerTextmateGroovyLanguage(monaco, editor)
}
