import { setItemToLocal, getItemFromLocal } from '@/utils/localStorage'
// 规范化主题名称
function normalizeThemeName(theme: string) {
  let currentTheme = theme
  // @REMOVE: deep、shallow后续版本中需要移除
  switch (theme) {
    case 'deep':
      currentTheme = 'dark'
      break
    case 'shallow':
      currentTheme = 'light'
      break
    default:
      break
  }
  return currentTheme
}
function setThemeClassName(theme: string) {
  window.document.documentElement.setAttribute('class', normalizeThemeName(theme))
}
function setTheme(theme: string) {
  setItemToLocal('theme', normalizeThemeName(theme))
  setThemeClassName(normalizeThemeName(theme))
}

function getTheme(): string {
  return normalizeThemeName(getItemFromLocal('theme'))
}
export { setThemeClassName, setTheme, getTheme }
