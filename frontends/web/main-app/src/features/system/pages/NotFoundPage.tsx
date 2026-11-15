import { useI18n } from '@/common/i18n/useI18n'
const containerStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '32px',
  background: 'linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%)',
} as const

const cardStyle = {
  width: 'min(480px, 100%)',
  padding: '40px 32px',
  borderRadius: '24px',
  background: 'rgba(255, 255, 255, 0.96)',
  boxShadow: '0 24px 60px rgba(35, 52, 94, 0.12)',
  textAlign: 'center',
} as const

const codeStyle = {
  margin: 0,
  color: '#3d7cf7',
  fontSize: '56px',
  fontWeight: 700,
  lineHeight: 1,
} as const

const titleStyle = {
  margin: '20px 0 12px',
  color: '#23345e',
  fontSize: '28px',
  fontWeight: 700,
} as const

const descriptionStyle = {
  margin: 0,
  color: 'rgba(35, 52, 94, 0.72)',
  fontSize: '15px',
  lineHeight: 1.7,
} as const

export function NotFoundPage() {
  const i18n = useI18n()
  return (
    <div style={containerStyle}>
      <section style={cardStyle} data-testid="not-found-page">
        <p style={codeStyle}>404</p>
        <h1 style={titleStyle}>
          {i18n.tn('common', 'page.notFound.title', '页面未找到')}
        </h1>
        <p style={descriptionStyle}>
          {i18n.tn(
            'common',
            'page.notFound.description',
            '请检查访问地址是否正确，或返回上一页后重试。'
          )}
        </p>
      </section>
    </div>
  )
}
