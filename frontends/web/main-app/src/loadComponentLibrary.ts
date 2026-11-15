import axios from 'axios'
import {
  registerComponentLibrary,
  type ComponentLibraryConfig,
  type RegisterOptions,
} from '@/common/micro/registerComponentLibrary'

async function loadLibraries(componentLibraries: ComponentLibraryConfig[], options?: RegisterOptions) {

  // 注册选项配置
  // 可以根据每个组件库的配置来决定是否加载 manifest 和 manage 文件
  const registerPromises = componentLibraries.map((libConfig) => {
    // 从组件库配置中获取注册选项，如果未配置则使用默认值
    const finalOptions: RegisterOptions = {
      loadManifest: libConfig.loadManifest ?? options?.loadManifest ?? false,
      loadManage: libConfig.loadManage ?? options?.loadManage ?? false,
      awaitMount: libConfig.awaitMount ?? options?.awaitMount ?? true,
    }
    return registerComponentLibrary(libConfig, finalOptions)
  })

  // 等待所有组件库注册完成
  await Promise.allSettled(registerPromises)
}

/**
 * 注册所有组件库微应用
 * 从 store 或 /custom-component-library.json 加载组件库配置并进行注册
 */
export async function loadComponentLibraries(componentLibraries: ComponentLibraryConfig[] | null | undefined) {
  let compLibs: ComponentLibraryConfig[] = []

  // 优先从 store 获取组件库配置
  if (componentLibraries && componentLibraries.length > 0) {
    compLibs = componentLibraries!
  } else if (!componentLibraries) {
    // 否则从配置文件加载
    let response
    try {
      response = await axios.get<ComponentLibraryConfig[]>('/custom-component-libraries.json')
    } catch (error) {
      response = null
    }
    compLibs = (response && response.data) || []
  }

  return await loadLibraries(compLibs)
}

export async function loadPlatformComponentLibrary(componentLibraries: ComponentLibraryConfig[]) {
  return await loadLibraries(componentLibraries, { loadManifest: true, loadManage: false })
}