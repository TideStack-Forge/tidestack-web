import { Icon } from './Icon'

interface BrandProps {
  appName?: string
  logo?: string
  theme?: string
  showName?: boolean
  className?: string
}

export function Brand({ appName = '', logo = '', theme = '', showName = true, className }: BrandProps) {
  return (
    <div className={className ? `app-brand ${className}` : 'app-brand'}>
      {logo ? (
        <Icon icon={logo} theme={theme} className="app-brand__logo" />
      ) : (
        <img src={require('@/assets/images/logo.svg')} alt="" className="app-brand__logo" />
      )}
      {showName ? <p className="app-brand__name">{appName}</p> : null}
    </div>
  )
}
