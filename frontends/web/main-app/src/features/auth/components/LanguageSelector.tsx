import { useEffect, useState } from 'react'
import { i18nService } from '@/common/i18n'

export function LanguageSelector() {
  const [currentLocale, setCurrentLocale] = useState('')
  const [languages, setLanguages] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    setCurrentLocale(i18nService.getManager().getLocale())
    i18nService
      .loadLanguages()
      .then((nextLanguages) => {
        setLanguages(nextLanguages)
      })
      .catch((error) => {
        console.warn('Failed to load languages:', error)
        setLanguages([
          { value: 'zh-CN', label: '简体中文' },
          { value: 'en-US', label: 'English' },
        ])
      })

    const unsubscribe = i18nService.getManager().onLocaleChange((locale) => {
      setCurrentLocale(locale)
    })

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  if (languages.length <= 1) {
    return null
  }

  return (
    <div className="language-selector-wrapper">
      <i className="fa-solid fa-language language-selector-icon" />
      <select
        value={currentLocale}
        className="language-selector"
        onChange={(event) => {
          const locale = event.currentTarget.value
          i18nService
            .switchLanguage(locale)
            .then(() => {
              setCurrentLocale(locale)
            })
            .catch((error) => {
              console.warn('Failed to switch language:', error)
            })
        }}>
        {languages.map((language) => (
          <option key={language.value} value={language.value}>
            {language.label}
          </option>
        ))}
      </select>
    </div>
  )
}
