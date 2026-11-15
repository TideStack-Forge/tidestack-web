import { useEffect, useState } from 'react'
import AmisComponent from '@/components/amis/AmisComponent'
import { Client } from '@/utils/http'

type ConsentView = {
  contextId: string
  viewRevision: string
  client: { name: string; verifiedRedirectOrigin: string }
  account: { displayName: string; accountLabel: string }
  identity?: { scopes: string[]; claims: Record<string, unknown> }
  business?: { permissions: { name: string; scope: string }[] }
  offlineAccess?: { requested: boolean; explanation: string }
  csrf: { parameterName: string; token: string }
}

export default function OidcConsentPage() {
  const [view, setView] = useState<ConsentView>()
  const [schema, setSchema] = useState<any>()
  const [error, setError] = useState('')
  const [changed] = useState(
    () => new URLSearchParams(window.location.search).get('result') === 'changed'
  )
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => {
    let cancelled = false
    const query = new URLSearchParams(window.location.search)
    const result = query.get('result')
    const recovery: Record<string, string> = {
      expired: '授权请求已失效，请回到接入应用重新发起。',
      processed: '此授权请求已处理，请回到接入应用。',
      invalid: '授权请求无效，请回到接入应用重新发起。',
      unavailable: '授权服务暂不可用，请稍后从接入应用重试。',
    }
    if (result && recovery[result]) {
      setError(recovery[result])
      return
    }
    const params = query.has('contextId')
      ? { contextId: query.get('contextId') }
      : { state: query.get('state') }
    Promise.all([
      Client.get<ConsentView>('/api/auth/oidc/consent-context', params, {
        skipAuth: true,
        withCredentials: true,
        isSilent: true,
      }),
      Client.get<any>(
        '/api/ui-schema',
        { path: '/auth/oidc-consent' },
        {
          skipAuth: true,
          withCredentials: true,
          isSilent: true,
        }
      ),
    ])
      .then(([context, page]) => {
        if (cancelled) return
        if (
          context.data.code !== 0 ||
          !context.data.data?.contextId ||
          page.data.code !== 0
        )
          throw new Error(context.data.msg || '授权请求已失效，请从接入应用重新发起。')
        setView(context.data.data)
        setSchema(page.data.data)
        window.history.replaceState(
          null,
          '',
          '/login/oidc/consent?contextId=' +
            encodeURIComponent(context.data.data.contextId)
        )
      })
      .catch((failure: unknown) => {
        if (!cancelled)
          setError(failure instanceof Error ? failure.message : '无法读取授权请求。')
      })
    return () => {
      cancelled = true
    }
  }, [])

  function submit(values: Record<string, unknown>, cancel = false) {
    if (!view || submitting) return
    setSubmitting(true)
    const fields: Record<string, string> = {
      context_id: view.contextId,
      view_revision: view.viewRevision,
      decision: cancel ? 'cancel' : 'continue',
      [view.csrf.parameterName]: view.csrf.token,
    }
    if (view.identity)
      fields.identity_approved = String(!cancel && values.identity_approved === true)
    if (view.business)
      fields.business_approved = String(!cancel && values.business_approved === true)
    if (view.offlineAccess)
      fields.offline_approved = String(!cancel && values.offline_approved === true)
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = '/oauth2/authorize'
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }
    document.body.appendChild(form)
    form.submit()
  }

  return (
    <main className="login-page login-page--center">
      <section
        className="login-card"
        style={{ maxWidth: 720, width: '100%', padding: 32 }}>
        <h1>接入应用正在申请授权</h1>
        {error ? (
          <div role="alert">
            <p>{error}</p>
            <a href="/">返回平台</a>
          </div>
        ) : !view || !schema ? (
          <p role="status">正在读取授权内容…</p>
        ) : (
          <>
            {changed && <p role="status">授权内容已变化，请核对后重新选择。</p>}
            <h2>{view.client.name}</h2>
            <p>{view.client.verifiedRedirectOrigin}</p>
            <p>
              当前账号：{view.account.displayName}（{view.account.accountLabel}）
            </p>
            {view.identity && (
              <section>
                <h3>身份信息</h3>
                <dl>
                  {Object.entries(view.identity.claims).map(([key, value]) => (
                    <div key={key}>
                      <dt>
                        {(
                          {
                            sub: '用户标识',
                            name: '姓名',
                            preferred_username: '用户名',
                            email: '邮箱',
                            email_verified: '邮箱已验证',
                            phone_number: '电话',
                            phone_number_verified: '电话已验证',
                            picture: '头像',
                            gender: '性别',
                            birthdate: '出生日期',
                          } as Record<string, string>
                        )[key] || '身份资料'}
                      </dt>
                      <dd>{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            {view.business && (
              <section>
                <h3>业务功能</h3>
                <ul>
                  {view.business.permissions.map((permission) => (
                    <li key={permission.scope}>{permission.name}</li>
                  ))}
                </ul>
                <p>
                  同意后授权上述全部业务功能。持续访问仍受平台会话有效期和撤销规则约束。
                </p>
              </section>
            )}
            <AmisComponent
              amisSchema={schema}
              style={{ height: 'auto' }}
              amisProps={{
                data: { ...view, submitting },
                onSubmit: (values: Record<string, unknown>) => {
                  submit(values)
                  return false
                },
              }}
            />
            <button type="button" disabled={submitting} onClick={() => submit({}, true)}>
              取消授权
            </button>
          </>
        )}
      </section>
    </main>
  )
}
