import { useEffect, useRef, useState, type FormEvent } from 'react'
import { readCurrentRoute } from '@/router/routerFacade'
import AmisComponent from '@/components/amis/AmisComponent'
import { Client } from '@/utils/http'
import { commit } from '@/store/storeFacade'

type Kind = 'email' | 'phone'
type Field = { name: string; label: string; editable: boolean; writeMode: string }
type View = {
  status: string
  schemaRevision: string
  profileRevision: number
  fields: Field[]
  values: Record<string, unknown>
  contactStatus: Record<string, boolean>
  editSchema: any
}
type Pending = { status: string; requestId?: string; maskedValue?: string }
const contactPath = (kind: Kind) => `/api/sys/user/me/contacts/${kind}/changes`

async function result<T>(
  request: Promise<{ data: { code: number; msg: string; data: T } }>
): Promise<T> {
  const { data } = await request
  if (data.code !== 0) throw new Error(data.msg || '操作失败，请稍后重试。')
  return data.data
}

export function AdminUserProfilePage() {
  const identity = readCurrentRoute()?.query?.userIdentity
  return typeof identity === 'string' && identity ? (
    <UserProfilePage key={identity} adminIdentity={identity} />
  ) : (
    <p role="alert">请选择需要维护的账号。</p>
  )
}

export default function UserProfilePage({
  adminIdentity,
}: { adminIdentity?: string } = {}) {
  const profilePath = `/api/sys/user/${adminIdentity ? encodeURIComponent(adminIdentity) : 'me'}/profile`
  const [view, setView] = useState<View>()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const emailLink = useRef<{ requestId: string; ticket: string }>()

  async function load() {
    setView(await result(Client.get<View>(profilePath, undefined, { isSilent: true })))
  }

  async function run(action: () => Promise<void>) {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await action()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '暂时无法维护资料。')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const requestId = params.get('contactRequestId'),
      ticket = params.get('ticket')
    if (!adminIdentity && requestId && ticket) {
      emailLink.current = { requestId, ticket }
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search
      )
    }
    void run(async () => {
      const link = emailLink.current
      emailLink.current = undefined
      if (link) {
        try {
          await result(
            Client.post(
              `${contactPath('email')}/${encodeURIComponent(link.requestId)}/confirm`,
              { ticket: link.ticket },
              { isSilent: true }
            )
          )
          setNotice('联系邮箱已验证。')
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : '邮箱验证链接已失效。')
        }
      }
      await load()
    })
  }, [])

  function patch(values: Record<string, unknown>) {
    if (!view || busy) return false
    const changes: Record<string, unknown> = {}
    for (const field of view.fields) {
      if (
        !field.editable ||
        field.writeMode !== 'PROFILE_PATCH' ||
        !Object.prototype.hasOwnProperty.call(values, field.name)
      )
        continue
      const value = values[field.name] === '' ? null : values[field.name]
      if (value !== (view.values[field.name] ?? null)) changes[field.name] = value
    }
    if (!Object.keys(changes).length) {
      setNotice('没有需要保存的变更。')
      return false
    }
    void run(async () => {
      setView(
        await result(
          Client.patch<View>(
            profilePath,
            {
              schemaRevision: view.schemaRevision,
              expectedProfileRevision: view.profileRevision,
              changes,
            },
            { isSilent: true }
          )
        )
      )
      setNotice('资料已保存。')
      const userInfo = await result(
        Client.get('/api/sys/user/info', undefined, { isSilent: true })
      )
      commit('user/SET_USERINFO', userInfo)
    })
    return false
  }

  return (
    <main className="p-4">
      <h1>{adminIdentity ? `用户资料：${adminIdentity}` : '个人资料'}</h1>
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={() => void run(load)}>
            重新加载
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!view && !error && <p role="status">正在读取资料…</p>}
      {view?.status === 'READ_ONLY_EXTERNAL' && (
        <p>该账号由外部认证渠道管理，不能在平台修改资料。</p>
      )}
      {view?.editSchema && (
        <AmisComponent
          key={view.schemaRevision + ':' + view.profileRevision}
          amisSchema={view.editSchema}
          style={{ height: 'auto' }}
          amisProps={{ data: view.values, onSubmit: patch }}
        />
      )}
      {view?.fields
        .filter((field) => field.writeMode === 'CONTACT_CHANGE')
        .map((field) =>
          adminIdentity ? (
            <AdminContactField
              key={field.name}
              identity={adminIdentity}
              field={field}
              view={view}
              onApplied={load}
            />
          ) : (
            <ContactField
              key={field.name}
              kind={field.name === 'email' ? 'email' : 'phone'}
              field={field}
              view={view}
              onApplied={load}
            />
          )
        )}
    </main>
  )
}

function ContactField({
  kind,
  field,
  view,
  onApplied,
}: {
  kind: Kind
  field: Field
  view: View
  onApplied: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState<Pending>()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const path = contactPath(kind)
  const value = view.values[field.name]
  const verified = view.contactStatus[field.name + 'Verified']
  useEffect(() => {
    let mounted = true
    if (field.editable)
      void result(Client.get<Pending>(path, undefined, { isSilent: true }))
        .then((next) => {
          if (mounted) setPending(next)
        })
        .catch((failure) => {
          if (mounted)
            setError(failure instanceof Error ? failure.message : '无法读取验证状态。')
        })
    return () => {
      mounted = false
    }
  }, [path, field.editable])

  async function run(action: () => Promise<void>) {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await action()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '联系方式操作失败。')
    } finally {
      setBusy(false)
    }
  }

  function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    event.currentTarget.reset()
    void run(async () => {
      const next = await result(
        Client.post<Pending>(
          path,
          {
            schemaRevision: view.schemaRevision,
            expectedProfileRevision: view.profileRevision,
            newValue: String(form.get('contact') || '') || null,
            password: String(form.get('password') || ''),
          },
          { isSilent: true }
        )
      )
      setEditing(false)
      if (next.status === 'PENDING') {
        setPending(next)
        return
      }
      setPending(undefined)
      await onApplied()
      setNotice(next.status === 'UNCHANGED' ? '联系方式未改变。' : '联系方式已保存。')
    })
  }

  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pending?.requestId) return
    const code = new FormData(event.currentTarget).get('code')
    void run(async () => {
      await result(
        Client.post(
          `${path}/${encodeURIComponent(pending.requestId!)}/confirm`,
          { code },
          { isSilent: true }
        )
      )
      setPending(undefined)
      await onApplied()
      setNotice('联系电话已验证。')
    })
  }

  return (
    <section className="mb-4">
      <h2>{field.label}</h2>
      <p>{value ? `${String(value)}（${verified ? '已验证' : '未验证'}）` : '未填写'}</p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {field.editable && !editing && (
        <button type="button" disabled={busy} onClick={() => setEditing(true)}>
          {value && !verified ? '修改或验证' : '修改'}
        </button>
      )}
      {editing && (
        <form onSubmit={change} autoComplete="off">
          <label>
            {field.label}
            <input
              name="contact"
              type={kind === 'email' ? 'email' : 'tel'}
              defaultValue={String(value ?? '')}
            />
          </label>
          {kind === 'phone' && <p>请输入带国家或地区代码的号码，例如 +8613800000000。</p>}
          <label>
            当前密码
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            提交变更
          </button>
          <button type="button" onClick={() => setEditing(false)}>
            取消
          </button>
        </form>
      )}
      {pending?.status === 'PENDING' && pending.requestId && (
        <div>
          <p role="status">
            {pending.maskedValue} 待验证。
            {kind === 'email'
              ? '请在当前登录会话打开邮件中的确认链接。'
              : '请输入短信验证码。'}
          </p>
          {kind === 'phone' && (
            <form onSubmit={confirm}>
              <label>
                短信验证码
                <input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  required
                />
              </label>
              <button type="submit" disabled={busy}>
                验证
              </button>
            </form>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await result(
                  Client.delete(
                    `${path}/${encodeURIComponent(pending.requestId!)}`,
                    undefined,
                    { isSilent: true }
                  )
                )
                setPending(undefined)
                setNotice('已取消待验证请求。')
              })
            }>
            取消待验证请求
          </button>
        </div>
      )}
    </section>
  )
}

function AdminContactField({
  identity,
  field,
  view,
  onApplied,
}: {
  identity: string
  field: Field
  view: View
  onApplied: () => Promise<void>
}) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  async function replace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = new FormData(event.currentTarget).get('contact')
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const kind = field.name === 'email' ? 'email' : 'phone'
      await result(
        Client.patch(
          `/api/sys/user/${encodeURIComponent(identity)}/contacts/${kind}`,
          {
            schemaRevision: view.schemaRevision,
            expectedProfileRevision: view.profileRevision,
            newValue: value || null,
          },
          { isSilent: true }
        )
      )
      await onApplied()
      setNotice('已保存，联系方式处于未验证状态。')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '保存失败，请重新加载。')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="mb-4">
      <h2>{field.label}</h2>
      <p>
        {view.contactStatus[field.name + 'Verified'] ? '已验证' : '未验证'}
        。管理员替换后需要用户重新验证。
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <form key={view.profileRevision} onSubmit={replace}>
        <label>
          {field.label}
          <input
            name="contact"
            type={field.name === 'email' ? 'email' : 'tel'}
            defaultValue={String(view.values[field.name] ?? '')}
            disabled={!field.editable}
          />
        </label>
        {field.editable && (
          <button type="submit" disabled={busy}>
            保存{field.label}
          </button>
        )}
      </form>
    </section>
  )
}
