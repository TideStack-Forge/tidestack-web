import { defer } from 'lodash'
import { Deferred } from '@/utils/Deferred'
import { alert as rawAlert, confirm as rawConfirm, prompt as rawPrompt } from 'amis'
import { i18nService } from '@/common/i18n'
import { processAmisSchema } from '@/common/i18n/amis'

import type { IScopedContext, ListenerAction, SchemaNode } from 'amis'
import type { DialogSchema } from 'amis/lib/renderers/Dialog'
import type { DrawerSchema } from 'amis/lib/renderers/Drawer'
import type { AlertProps } from 'amis-ui/lib/components/Alert'

export interface ConfirmOptions {
  className?: string
  closeOnEsc?: AlertProps['closeOnEsc']
  size?: AlertProps['size']
  confirmBtnLevel?: AlertProps['confirmBtnLevel']
  cancelBtnLevel?: AlertProps['cancelBtnLevel']
  confirmText?: AlertProps['confirmText']
  cancelText?: AlertProps['cancelText']
}
interface OuroborosDialogSchema extends Omit<DialogSchema, 'type' | 'body'> {
  type?: string
  url?: string
  schemaId?: string
  localeNamespace?: string
  body?: SchemaNode
  resizable?: boolean
  sizeSwitchable?: boolean
  sizeOptions?: Array<'' | 'sm' | 'md' | 'lg' | 'xl' | 'full'>
  onConfirm?: (values: any[]) => void
  onClose?: () => void
}

interface OuroborosDrawerSchema extends Omit<DrawerSchema, 'type'> {
  type?: string
  url?: string
  schemaId?: string
  localeNamespace?: string
  onConfirm: (values: any[]) => void
  onClose: () => void
}
interface OuroborosModalContext {
  [fieldName: string]: any
}

// openDialog 方法栈
const openDialogFnStack: ((
  schema: OuroborosDialogSchema,
  ctx: OuroborosModalContext
) => Promise<any>)[] = []

// openDrawer 方法栈
const openDrawerFnStack: ((
  schema: OuroborosDrawerSchema,
  ctx: OuroborosModalContext
) => Promise<any>)[] = []

const scopedRefDeferred = new Deferred<IScopedContext>()

scopedRefDeferred.promise.then((ref) => {
  pushModalMethods(ref.doAction.bind(ref))
})

export async function openDialog(
  schema: OuroborosDialogSchema,
  ctx: OuroborosModalContext = {}
) {
  await scopedRefDeferred.promise

  const top = openDialogFnStack[openDialogFnStack.length - 1]
  if (top) {
    return await top(
      schema.localeNamespace ? processAmisSchema(schema.localeNamespace, schema) : schema,
      ctx
    )
  } else {
    console.warn('openDialog: no scoped context found!')
    return false
  }
}

export async function openDrawer(
  schema: OuroborosDrawerSchema,
  ctx: OuroborosModalContext = {}
) {
  await scopedRefDeferred.promise
  const top = openDrawerFnStack[openDrawerFnStack.length - 1]
  if (top) {
    return await top(
      schema.localeNamespace ? processAmisSchema(schema.localeNamespace, schema) : schema,
      ctx
    )
  } else {
    console.warn('openDrawer: no scoped context found!')
  }
}

type ConfirmFn = (
  content: string | React.ReactNode,
  title?: string,
  optionsOrConfirmText?: string | ConfirmOptions,
  cancelText?: string
) => Promise<any>

export const confirm: ConfirmFn = (
  content,
  title = i18nService.getManager().tCommon('systemTip', '系统提示'),
  optionsOrConfirmText = i18nService.getManager().tCommon('confirm', '确定'),
  cancelText = i18nService.getManager().tCommon('cancel', '取消')
) => {
  const manager = i18nService.getManager()
  const options =
    typeof optionsOrConfirmText === 'string'
      ? { confirmText: optionsOrConfirmText, cancelText }
      : { ...optionsOrConfirmText }
  options.confirmText ??= manager.tCommon('confirm', '确定')
  options.cancelText ??= cancelText
  options.confirmBtnLevel ??= 'primary'
  options.cancelBtnLevel ??= 'default'
  return rawConfirm(
    content,
    title || manager.tCommon('systemTip', '系统提示'),
    options,
    options.cancelText
  )
}

export const alert: typeof rawAlert = (content, title, className) =>
  rawAlert(
    content,
    title ?? i18nService.getManager().tCommon('systemTip', '系统提示'),
    className
  )

export const prompt: typeof rawPrompt = (controls, defaultValue, title, confirmText) =>
  rawPrompt(
    controls,
    defaultValue,
    title ?? i18nService.getManager().tCommon('prompt.title', '请输入'),
    confirmText ?? i18nService.getManager().tCommon('confirm', '确定')
  )

export function pushModalMethods(doAction: (action: ListenerAction, ctx: any) => void) {
  openDialogFnStack.push((schema, ctx) => {
    const deferred = new Deferred<any>()
    doAction(
      {
        dialog: {
          ...schema,
          type: 'dialog',
          onConfirm(values: any[]) {
            deferred.resolve(values || [])
            schema.onConfirm?.(values)
          },
          onClose() {
            deferred.resolve(false)
            schema.onClose?.()
          },
        },
        actionType: 'dialog',
      },
      ctx || {}
    )
    return deferred.promise
  })
  openDrawerFnStack.push((schema, ctx) => {
    const deferred = new Deferred<any>()
    doAction(
      {
        drawer: {
          ...schema,
          type: 'drawer',
          onConfirm(values: any[]) {
            deferred.resolve(values || [])
            schema.onConfirm?.(values)
          },
          onClose() {
            deferred.resolve(false)
            schema.onClose?.()
          },
        },
        actionType: 'drawer',
      },
      ctx || {}
    )
    return deferred.promise
  })
}

export function popModalMethods() {
  openDialogFnStack.pop()
  openDrawerFnStack.pop()
}

export function init(ref: IScopedContext) {
  if (scopedRefDeferred.state === 'pending') {
    defer(scopedRefDeferred.resolve, ref)
  } else {
    // 清空栈
    openDialogFnStack.splice(0, openDialogFnStack.length)
    openDrawerFnStack.splice(0, openDrawerFnStack.length)
    defer(() => {
      pushModalMethods(ref.doAction.bind(ref))
    })
  }
}
