declare global {
  interface Window {
    $i18nDebug?: {
      getLocale: () => string
      getMessages: () => any
      test: (key: string, params?: any) => string
      switchTo: (locale: string) => Promise<void>
      clearCache: () => void
      showMissingKeys: () => string[]
    }
  }
}

export {}
