import { useSyncExternalStore } from 'react'
import { i18nService } from './index'

export function useI18n() {
  const manager = i18nService.getManager()
  useSyncExternalStore(
    (notify) => manager.onLocaleChange(notify),
    () => manager.getLocale(),
    () => manager.getLocale()
  )
  return manager
}
