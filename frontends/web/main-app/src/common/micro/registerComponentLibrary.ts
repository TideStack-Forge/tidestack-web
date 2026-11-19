import { loadMicroApp } from 'qiankun'
import axios from 'axios'
import { getCommonProps } from './commonProps'
import {
  canRetryMicroApp,
  recordMicroAppLoadFailure,
  recordMicroAppMountSuccessByName,
  registerMicroAppLoadTarget,
} from './loadRetry'
import { normalizeMicroEntry } from './utils'
import {
  createMicroEntryFetch,
  ensureSameOriginMicroEntryIsSafe,
} from './entryGuard'

import type { MicroApp } from 'qiankun'
import type { MicroWebCommonProps } from './commonProps'
import type { Evaluator } from 'amis'
import type {
  RendererConfig,
  RendererAction,
  OptionsControlProps,
  ValidateFn,
} from 'amis-core'
import type { RendererComponent } from 'amis-core/lib/factory'
import type {
  FormControlComponent,
  FormItemBasicConfig,
} from 'amis-core/lib/renderers/Item'
import type { OptionsBasicConfig } from 'amis-core/lib/renderers/Options'
import type { FunctionDocItem } from 'amis-formula/lib/types'
import type {
  BasePlugin,
  Validator,
  ActionPanel,
} from 'ouroboros-amis-runtime/editor/lazyRegister'

const MANIFEST_FILE_NAME = 'components.manifest.json'
const MANAGE_FILE_NAME = 'manage.json'

/**
 * 组件库配置接口
 */
export interface ComponentLibraryConfig {
  name: string
  entry?: string
  publicPath?: string
  [key: string]: any
}

/**
 * 组件描述对象接口
 */
export interface ComponentDescriptor {
  /** 组件名称（唯一标识） */
  name: string
  /** 组件显示标签 */
  label: string
  /** 组件描述 */
  description?: string
  /** 组件标签 */
  tags?: string[]
  [key: string]: any
}

/**
 * 组件清单接口
 */
export interface ComponentManifest {
  /** 渲染器组件（对应 AMIS 的 @Renderer） */
  renderers?: ComponentDescriptor[]
  /** 表单项组件（对应 AMIS 的 @FormItem） */
  formItems?: ComponentDescriptor[]
  /** 选项控制器组件（对应 AMIS 的 @OptionsControl） */
  optionsControls?: ComponentDescriptor[]
  /** 自定义动作（对应 AMIS 的 registerAction） */
  actions?: ComponentDescriptor[]
  /** 自定义校验规则（对应 AMIS 的 addRule） */
  rules?: ComponentDescriptor[]
  /** 自定义公式（对应 AMIS 的自定义函数） */
  formulas?: ComponentDescriptor[]
  /** 渲染器编辑器插件 */
  rendererEditorPlugins?: ComponentDescriptor[]
  /** 动作编辑器插件 */
  actionEditorPlugins?: ComponentDescriptor[]
  /** 校验器编辑器插件 */
  validatorEditorPlugins?: ComponentDescriptor[]
  /** 其他自定义组件类型 */
  [key: string]: ComponentDescriptor[] | any
}

/**
 * 组件管理配置接口（禁用列表）
 */
export interface ComponentManageConfig {
  renderers?: {
    disabled?: string[]
  }
  formItems?: {
    disabled?: string[]
  }
  optionsControls?: {
    disabled?: string[]
  }
  actions?: {
    disabled?: string[]
  }
  rules?: {
    disabled?: string[]
  }
  formulas?: {
    disabled?: string[]
  }
  rendererEditorPlugins?: {
    disabled?: string[]
  }
  actionEditorPlugins?: {
    disabled?: string[]
  }
  validatorEditorPlugins?: {
    disabled?: string[]
  }
  [key: string]:
    | {
        disabled?: string[]
      }
    | undefined
}

/**
 * 注册选项接口
 */
export interface RegisterOptions {
  /**
   * 是否加载 components.manifest.json
   * 如果为 true，将从 entry 目录下加载组件清单
   */
  loadManifest?: boolean

  /**
   * 是否加载 manage.json
   * 如果为 true，将从 entry 目录下加载组件管理配置（禁用列表）
   */
  loadManage?: boolean

  /**
   * 是否等待组件加载完成
   * 如果为 true，则等待组件加载完成再返回
   */
  awaitMount?: boolean

  /**
   * 组件库的父容器 id
   * 如果指定了父容器 id，则组件库将自动挂载到该容器下
   */
  parentContainerId?: string

  /**
   * 父容器元素
   * 如果指定了父容器元素，则组件库将自动挂载到该容器下
   */
  parentContainer?: HTMLElement
}

/**
 * 从 entry 目录加载配置文件
 */
async function loadConfigFromEntry<T>(
  entryUrl: string,
  configFileName: string
): Promise<T | null> {
  try {
    // 解析 entry URL，获取基础路径
    const url = new URL(entryUrl, window.location.origin)
    const basePath = url.pathname.replace(/\/[^/]*$/, '')
    const configUrl = `${basePath}/${configFileName}`

    const response = await axios.get<T>(configUrl)
    return response.data
  } catch (error) {
    console.warn(`Failed to load ${configFileName} from ${entryUrl}:`, error)
    return null
  }
}

/**
 * 根据清单和管理配置过滤组件
 */
function filterComponentsManifest(
  manifest: ComponentManifest | null,
  manage: ComponentManageConfig | null
): ComponentManifest | null {
  if (!manifest) {
    return null
  }

  const filtered: ComponentManifest = {}

  // 遍历清单中的每种组件类型
  for (const [componentType, components] of Object.entries(manifest)) {
    if (!Array.isArray(components)) {
      continue
    }

    // 获取该类型组件的禁用列表
    const disabledList = manage?.[componentType]?.disabled || []

    // 过滤掉被禁用的组件（根据组件对象的 name 字段进行匹配）
    filtered[componentType] = components.filter(
      (component) => !disabledList.includes(component.name)
    )
  }

  return filtered
}

function wrapFilteredComponentRegisterProps(
  props: MicroWebCommonProps,
  manifest: ComponentManifest
): MicroWebCommonProps {
  const {
    __utils__: {
      FormItem,
      Renderer,
      OptionsControl,
      addRule,
      registerFormula,
      registerAction,
      registerEditorPlugin,
      registerValidator,
      registerActionPanel,
    },
  } = props
  return {
    ...props,
    __utils__: {
      ...props.__utils__,
      Renderer(config: RendererConfig) {
        const finalName = config.name ?? config.type
        if (manifest.renderers?.find((item) => item.name === finalName)) {
          return Renderer(config)
        }
        return <T extends RendererComponent>(component: T) => component
      },
      FormItem(config: FormItemBasicConfig) {
        const finalName = config.name ?? config.type
        if (manifest.formItems?.find((item) => item.name === finalName)) {
          return FormItem(config)
        }
        return (cmp: FormControlComponent) => cmp
      },
      OptionsControl(config: OptionsBasicConfig) {
        const finalName = config.name ?? config.type
        if (manifest.optionsControls?.find((item) => item.name === finalName)) {
          return OptionsControl(config)
        }
        return <T extends React.ComponentType<OptionsControlProps>>(cmp: T) => cmp
      },
      addRule(ruleName: string, validateFn: ValidateFn, errorMessage?: string) {
        if (manifest.rules?.find((item) => item.name === ruleName)) {
          return addRule(ruleName, validateFn, errorMessage)
        }
      },
      registerFormula(
        formulaName: string,
        formula: (this: Evaluator, ...args: Array<any>) => any,
        fnInfo?: FunctionDocItem
      ) {
        if (manifest.formulas?.find((item) => item.name === formulaName)) {
          registerFormula(formulaName, formula, fnInfo)
        }
      },
      registerAction(actionType: string, action: RendererAction) {
        if (manifest.actions?.find((item) => item.name === actionType)) {
          registerAction(actionType, action)
        }
      },
      registerEditorPlugin(plugin: BasePlugin) {
        if (manifest.rendererEditorPlugins?.find((item) => item.name === plugin.name)) {
          registerEditorPlugin(plugin)
        }
      },
      registerValidator(validator: Validator) {
        if (
          manifest.validatorEditorPlugins?.find((item) => item.name === validator.name)
        ) {
          registerValidator(validator)
        }
      },
      registerActionPanel(actionType: string, actionPanel: ActionPanel) {
        if (manifest.actionEditorPlugins?.find((item) => item.name === actionType)) {
          registerActionPanel(actionType, actionPanel)
        }
      },
    },
  }
}

/**
 * 构建自定义 fetcher，支持 publicPath 与 entry 路径不一致的情况
 */
function buildFetcher(libConfig: ComponentLibraryConfig) {
  const fetcher = async (input: RequestInfo, init?: RequestInit | undefined) => {
    const res = await window.fetch(input, init)
    if (res.status !== 200) {
      throw new Error(
        `加载组件库 ${libConfig.name || '[未知]'} 时出错：${res.status} ${res.statusText}`
      )
    }
    return res
  }

  return createMicroEntryFetch(fetcher)
}

/**
 * 注册单个组件库微应用
 * @param libConfig 组件库配置对象
 * @param options 注册选项
 * @returns 返回微应用实例及其挂载 Promise
 */
export async function registerComponentLibrary(
  libConfig: ComponentLibraryConfig,
  options: RegisterOptions = {}
): Promise<MicroApp> {
  const {
    loadManifest = false,
    loadManage = false,
    awaitMount = true,
    parentContainerId = 'custom-component',
  } = options

  // 获取 entry 路径
  const entry = libConfig?.entry || libConfig?.publicPath
  if (!entry) {
    throw new Error(`Component library ${libConfig.name} missing entry or publicPath`)
  }

  const normalizedEntry = normalizeMicroEntry(entry)

  const stableName = `component-library:${libConfig.name || entry}`
  const retryKey = `component-library:${entry}`
  registerMicroAppLoadTarget(stableName, retryKey)
  if (!canRetryMicroApp(retryKey)) {
    throw new Error(`Component library ${libConfig.name || entry} retry limit exceeded`)
  }
  await ensureSameOriginMicroEntryIsSafe(normalizedEntry)
  recordMicroAppLoadFailure(retryKey)

  // 获取父容器
  const parentContainer =
    options.parentContainer ?? document.getElementById(parentContainerId)
  if (!parentContainer) {
    throw new Error('Parent container not found')
  }

  // 加载配置文件
  let manifest: ComponentManifest | null = null
  let manage: ComponentManageConfig | null = null
  let filteredComponentsManifest: ComponentManifest | null = null

  if (loadManifest) {
    manifest = await loadConfigFromEntry<ComponentManifest>(
      normalizedEntry,
      MANIFEST_FILE_NAME
    )
    if (loadManage) {
      manage = await loadConfigFromEntry<ComponentManageConfig>(
        normalizedEntry,
        MANAGE_FILE_NAME
      )
    }
  }

  // 如果同时加载了清单和管理配置，进行过滤
  if (manifest && manage) {
    filteredComponentsManifest = filterComponentsManifest(manifest, manage)
  } else if (manifest) {
    filteredComponentsManifest = manifest
  }

  const containerId = stableName.replace(/[^A-Za-z0-9_-]/g, '-')

  // 创建容器元素
  const container = document.createElement('div')
  container.id = containerId
  parentContainer.appendChild(container)

  const commonProps = getCommonProps()

  // 构建微应用配置
  const appConfig = {
    name: stableName,
    container,
    entry: normalizedEntry,
    props: filteredComponentsManifest
      ? wrapFilteredComponentRegisterProps(commonProps, filteredComponentsManifest)
      : commonProps,
  }

  const app = loadMicroApp(appConfig, {
    fetch: buildFetcher(libConfig),
  })

  const mountPromise = app.mountPromise
    .then(() => {
      recordMicroAppMountSuccessByName(stableName)
    })
    .catch((error) => {
      throw error
    })

  // 如果需要等待挂载，则 await 一下
  if (awaitMount) {
    await mountPromise
  }

  return app
}

/**
 * 批量注册组件库微应用
 * @param libConfigs 组件库配置数组
 * @param options 注册选项（应用于所有组件库）
 * @returns 返回所有注册 Promise 的结果
 */
export async function registerComponentLibraries(
  libConfigs: ComponentLibraryConfig[],
  options: RegisterOptions = {}
): Promise<PromiseSettledResult<MicroApp>[]> {
  const registerPromises = libConfigs.map((libConfig) =>
    registerComponentLibrary(libConfig, options)
  )

  return Promise.allSettled(registerPromises)
}
