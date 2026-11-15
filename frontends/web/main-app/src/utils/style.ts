import { addStyle } from 'amis-core'

function addCustomStyle({
  styles,
  id,
}: {
  styles: string | string[]
  id?: string
}): () => void {
  const styleText = Array.isArray(styles) ? styles.join('\n') : styles
  if (!styleText) return () => {}
  const styleId = id ?? `style-${Date.now().toFixed(0)}`
  addStyle(styleText, styleId)
  return () => {
    const styleElement = document.getElementById(styleId)
    if (styleElement) styleElement.remove()
  }
}

export { addCustomStyle }
