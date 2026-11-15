import { str2function } from 'amis-core'
import isEqual from 'lodash/isEqual'
import type { ActionSchema } from 'amis/lib/renderers/Action'

const MODAL_SCHEMA_RENDERER_TYPES = new Set(['amis-schema', 'ui-schema'])
const MODAL_SCHEMA_FORM_ACTION_PROP_KEYS = [
  'rewriteProps',
  'replaceProps',
  'defaultProps',
  'mergeProps',
] as const

export type ModalBodyFormNormalization = {
  schema: any
  actions: ActionSchema[] | null
  title?: any
}

type ModalBodyFormNormalizationOptions = {
  translate?: (key: string) => string
  loadingConfig?: any
}

type ModalStoreSchemaKey = 'dialogSchema' | 'drawerSchema'

const FORM_DEFAULT_SUBMIT_TEXT = 'Form.submit'
const FORM_ACTION_CONTROL_TYPES = new Set([
  'submit',
  'button',
  'button-group',
  'reset',
])
const MODAL_FORM_NORMALIZATION_META = Symbol('modalFormNormalizationMeta')
const MODAL_SCHEMA_SOURCE = Symbol('modalSchemaSource')

/** Normalize at schema boundaries, before a modal or its loaded form renders. */
export function normalizeModalSchema(
  schema: any,
  options: ModalBodyFormNormalizationOptions = {}
): any {
  if (!schema || typeof schema !== 'object' || schema.updateActions === false)
    return schema
  const normalized = normalizeModalBodyFormForRender(schema.body, options)
  if (!normalized) return schema
  return {
    ...schema,
    body: normalized.schema,
    ...(schema.title === undefined && normalized.title !== undefined
      ? { title: normalized.title }
      : {}),
    ...(schema.actions === undefined && normalized.actions !== null
      ? { actions: normalized.actions }
      : {}),
  }
}

function getRuntimeModalSource(props: any) {
  const schema = props.store?.schema
  return schema && MODAL_SCHEMA_SOURCE in Object(schema)
    ? schema[MODAL_SCHEMA_SOURCE]
    : schema
}

/** Keep the loader mounted; publish only the loaded form's modal metadata. */
export function resolveModalBodySchema(props: any, body: any) {
  const source = getRuntimeModalSource(props)
  const declared = props.$schema || props
  const modal = { ...declared, ...source, body }
  if (modal.updateActions === false) return body
  const normalized = normalizeModalSchema(modal, props)
  const nextSchema = { ...source }
  for (const key of ['title', 'actions']) {
    if (normalized[key] !== undefined) nextSchema[key] = normalized[key]
  }
  // Derived values must not become declarations on the next async resolution.
  Object.defineProperty(nextSchema, MODAL_SCHEMA_SOURCE, { value: source })
  if (!isEqual(props.store.schema || {}, nextSchema)) {
    props.store.setSchema(nextSchema)
  }
  return normalized.body
}

export function resetModalBodySchema(props: any) {
  if (props.store?.schema && MODAL_SCHEMA_SOURCE in Object(props.store.schema)) {
    props.store.setSchema(getRuntimeModalSource(props))
  }
}

type ModalFormNormalizationMeta = {
  actions: ActionSchema[] | null
  title?: any
}

function hasArrayActions(value: any) {
  return Array.isArray(value?.actions)
}

function hasSchemaValue(schema: any, prop: string) {
  return schema?.[prop] !== undefined
}

function getModalSchemaFromProps(props: any, storeSchemaKey: ModalStoreSchemaKey) {
  const store = props?.store
  const schema = props?.$schema || store?.[storeSchemaKey]
  const runtime = store?.schema
  if (runtime && typeof runtime === 'object') return { ...schema, ...runtime }
  return schema && typeof schema === 'object' ? schema : null
}

export function getModalActionsFromProps(
  props: any,
  storeSchemaKey: ModalStoreSchemaKey
) {
  const schema = getModalSchemaFromProps(props, storeSchemaKey)
  if (schema) {
    return schema.actions
  }

  return Array.isArray(props?.actions) && !props.actions.length
    ? undefined
    : props?.actions
}

function shouldDisableModalFormPanel(schema: any) {
  return schema.wrapWithPanel !== true
}

function findModalFormSchema(schema: any): any | null {
  return findDirectModalFormSchema(schema) || findBubblingModalFormSchema(schema)
}

function normalizeModalFormPanel(schema: any): { title?: any } | null {
  const formSchema = findModalFormSchema(schema)
  if (!formSchema || formSchema.type !== 'form') {
    return null
  }

  if (!shouldDisableModalFormPanel(formSchema)) {
    return {}
  }

  const hasTitle = hasSchemaValue(formSchema, 'title')
  const title = formSchema.title
  formSchema.wrapWithPanel = false
  if (hasTitle) {
    delete formSchema.title
  }

  return hasTitle ? { title } : {}
}

function normalizeModalBodyForm(
  schema: any,
  options: ModalBodyFormNormalizationOptions = {}
): Omit<ModalBodyFormNormalization, 'schema'> | null {
  const actionSchema =
    findDirectModalActionSchema(schema) || findBubblingModalFormSchema(schema)
  const formSchema = findModalFormSchema(schema)
  const panelNormalization = normalizeModalFormPanel(schema)

  if (!actionSchema) {
    return panelNormalization ? { actions: null, ...panelNormalization } : null
  }

  const cachedNormalization = readModalFormNormalizationMeta(actionSchema)
  if (cachedNormalization) {
    return {
      ...cachedNormalization,
      ...(panelNormalization || {}),
      title:
        typeof panelNormalization?.title !== 'undefined'
          ? panelNormalization.title
          : cachedNormalization.title,
    }
  }

  const hasConfiguredActions = hasSchemaValue(actionSchema, 'actions')
  const hasExplicitActions = hasArrayActions(actionSchema)
  const hasDefaultFormActions =
    actionSchema.type === 'form' && !hasConfiguredActions

  if (!hasConfiguredActions && !hasDefaultFormActions) {
    return panelNormalization ? { actions: null, ...panelNormalization } : null
  }

  const actions = hasConfiguredActions
    ? hasExplicitActions
      ? actionSchema.actions
      : []
    : buildDefaultFormActions(actionSchema, options)
  actionSchema.actions = []

  if (formSchema && formSchema !== actionSchema && !hasArrayActions(formSchema)) {
    formSchema.actions = []
  }

  const normalization = {
    actions,
    ...(panelNormalization || {}),
  }
  writeModalFormNormalizationMeta(actionSchema, normalization)
  return normalization
}

function readModalFormNormalizationMeta(
  schema: any
): ModalFormNormalizationMeta | null {
  return schema?.[MODAL_FORM_NORMALIZATION_META] || null
}

function writeModalFormNormalizationMeta(
  schema: any,
  normalization: ModalFormNormalizationMeta
) {
  Object.defineProperty(schema, MODAL_FORM_NORMALIZATION_META, {
    value: normalization,
    enumerable: false,
    configurable: true,
  })
}

export function normalizeModalBodyFormForRender(
  schema: any,
  options: ModalBodyFormNormalizationOptions = {}
): ModalBodyFormNormalization | null {
  const clonedSchema = cloneModalSchema(schema)
  const normalized = normalizeModalBodyForm(clonedSchema, options)
  return normalized ? { schema: clonedSchema, ...normalized } : null
}

function getFormActionControlType(item: any): any {
  return item?.body?.[0]?.type || item?.body?.type || item?.type
}

function hasInlineFormActionControl(body: any) {
  return (
    Array.isArray(body) &&
    body.some((item) => FORM_ACTION_CONTROL_TYPES.has(getFormActionControlType(item)))
  )
}

function buildDefaultFormActions(
  formSchema: any,
  options: ModalBodyFormNormalizationOptions
): ActionSchema[] {
  const submitText =
    formSchema.submitText === undefined
      ? FORM_DEFAULT_SUBMIT_TEXT
      : formSchema.submitText
  if (!submitText || hasInlineFormActionControl(formSchema.body)) {
    return []
  }

  const translate = options.translate || ((key: string) => key)
  return [
    {
      type: 'submit',
      label: translate(submitText),
      primary: true,
      loadingConfig:
        options.loadingConfig === undefined
          ? formSchema.loadingConfig
          : options.loadingConfig,
    },
  ]
}

export function normalizeModalFormPanelForRender(
  schema: any
): { schema: any; title?: any } | null {
  const clonedSchema = cloneModalSchema(schema)
  const normalized = normalizeModalFormPanel(clonedSchema)
  return normalized ? { schema: clonedSchema, ...normalized } : null
}

function suppressModalSchemaRendererFormActions(body: any) {
  if (!body || typeof body !== 'object') {
    return body
  }

  const suppressedSchema =
    body.$schema && body.$schema !== body
      ? suppressModalSchemaRendererFormActions(body.$schema)
      : body.$schema
  const hasOwnActions = hasArrayActions(body)
  const suppressedPropKeys = MODAL_SCHEMA_FORM_ACTION_PROP_KEYS.filter((key) => {
    return hasArrayActions(body[key])
  })
  const hasSuppressedSchema = suppressedSchema !== body.$schema

  if (!hasOwnActions && !suppressedPropKeys.length && !hasSuppressedSchema) {
    return body
  }

  const nextBody = {
    ...body,
    wrapWithPanel: false,
  }

  if (hasOwnActions) {
    nextBody.actions = []
  }

  suppressedPropKeys.forEach((key) => {
    nextBody[key] = {
      ...body[key],
      actions: [],
      wrapWithPanel: false,
    }
  })

  if (hasSuppressedSchema) {
    nextBody.$schema = suppressedSchema
  }

  return nextBody
}

function resolveModalServiceSchema(payload: any): any | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  if (payload.type) {
    return payload
  }

  return payload.data && typeof payload.data === 'object' ? payload.data : null
}

function notifyModalServiceSchemaResolved(
  payload: any,
  onSchemaResolved: (schema: any) => any
) {
  const schema = resolveModalServiceSchema(payload)
  if (schema) {
    const resolvedSchema = onSchemaResolved(schema)
    if (resolvedSchema && resolvedSchema !== schema) {
      if (payload === schema) {
        return resolvedSchema
      }

      if (payload?.data === schema) {
        return {
          ...payload,
          data: resolvedSchema,
        }
      }
    }
  }
  return payload
}

function findOnlyFormSchema(schema: any): any | null {
  if (Array.isArray(schema)) {
    return schema.length === 1 && schema[0]?.type === 'form' ? schema[0] : null
  }

  return schema?.type === 'form' ? schema : null
}

function findDirectModalFormSchema(schema: any): any | null {
  const rootForm = findOnlyFormSchema(schema)
  if (rootForm) {
    return rootForm
  }

  if (schema?.type === 'page') {
    return findOnlyFormSchema(schema.body)
  }

  return null
}

function findDirectModalActionSchema(schema: any): any | null {
  const directForm = findDirectModalFormSchema(schema)
  if (hasArrayActions(directForm)) {
    return directForm
  }

  if (schema?.type === 'page' && hasArrayActions(schema)) {
    return schema
  }

  return directForm
}

function findBubblingModalFormSchema(schema: any): any | null {
  if (Array.isArray(schema)) {
    for (const item of schema) {
      const form = findBubblingModalFormSchema(item)
      if (form) {
        return form
      }
    }
    return null
  }

  if (!schema || typeof schema !== 'object') {
    return null
  }

  if (schema.type === 'form' && schema.bubbleActionsToModal === true) {
    return schema
  }

  for (const value of Object.values(schema)) {
    const form = findBubblingModalFormSchema(value)
    if (form) {
      return form
    }
  }

  return null
}

function cloneModalSchema(schema: any): any {
  if (Array.isArray(schema)) {
    return schema.map((item) => cloneModalSchema(item))
  }

  if (!schema || typeof schema !== 'object') {
    return schema
  }

  return Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [key, cloneModalSchema(value)])
  )
}

export function normalizeModalBodyFormActions(schema: any): ActionSchema[] | null {
  const normalized = normalizeModalBodyForm(schema)
  return normalized ? normalized.actions : null
}

export function normalizeModalBodyFormActionsForRender(
  schema: any
): { schema: any; actions: ActionSchema[] } | null {
  const normalized = normalizeModalBodyFormForRender(schema)
  return normalized && normalized.actions !== null
    ? { schema: normalized.schema, actions: normalized.actions }
    : null
}

export function suppressModalBodyFormActionsForRender(schema: any): any {
  const normalized = normalizeModalBodyFormForRender(schema)
  return normalized ? normalized.schema : schema
}

export function buildModalFooterActionData(store: any): Record<string, unknown> {
  const storeData = store?.data
  const formData = store?.formData
  return {
    ...(storeData && typeof storeData === 'object' ? storeData : {}),
    ...(formData && typeof formData === 'object' ? formData : {}),
  }
}

export function withModalSchemaResolvedHandler(
  body: any,
  onSchemaResolved: (schema: any) => any,
  suppressSchemaRendererActions = false
): any {
  if (Array.isArray(body)) {
    return body.length === 1
      ? [
          withModalSchemaResolvedHandler(
            body[0],
            onSchemaResolved,
            suppressSchemaRendererActions
          ),
        ]
      : body
  }

  if (!body || typeof body !== 'object' || !MODAL_SCHEMA_RENDERER_TYPES.has(body.type)) {
    if (body?.type === 'service' && body.schemaApi) {
      return {
        ...body,
        schemaApi: withModalServiceSchemaApiHandler(body.schemaApi, onSchemaResolved),
      }
    }

    return body
  }

  return {
    ...(suppressSchemaRendererActions
      ? suppressModalSchemaRendererFormActions(body)
      : body),
    onSchemaResolved,
  }
}

function withModalServiceSchemaApiHandler(
  schemaApi: any,
  onSchemaResolved: (schema: any) => any
) {
  const api = typeof schemaApi === 'string' ? { url: schemaApi } : { ...schemaApi }
  const originalAdaptor = api.adaptor || api.responseAdaptor

  return {
    ...api,
    adaptor: (payload: any, response: any, currentApi: any, context: any) => {
      const adapted =
        typeof originalAdaptor === 'function'
          ? originalAdaptor(payload, response, currentApi, context)
          : typeof originalAdaptor === 'string'
            ? str2function(
                originalAdaptor,
                'payload',
                'response',
                'api',
                'context'
              )?.(payload, response, currentApi, context)
            : payload
      if (adapted?.then) {
        return adapted.then((result: any) =>
          notifyModalServiceSchemaResolved(result, onSchemaResolved)
        )
      }

      return notifyModalServiceSchemaResolved(adapted, onSchemaResolved)
    },
  }
}
