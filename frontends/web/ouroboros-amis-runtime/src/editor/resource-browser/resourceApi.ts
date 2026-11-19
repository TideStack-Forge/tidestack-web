import axios from 'axios'

export type ResourceBrowserDirectoryOption = {
  label: string
  value: string
  children?: ResourceBrowserDirectoryOption[]
}

export type FrontendResourceItem = {
  key: string
  fileName: string
  contentType?: string
  directory?: string
  size?: number
  lastModifiedTime?: string
  isMissing?: boolean
}

type ResourceListRecord = {
  model?: {
    key?: string
    fileName?: string
    contentType?: string
    directory?: string
  }
  size?: number
  lastModifiedTime?: string
}

type ItemsWebApiResult<T> = {
  code?: number
  msg?: string
  data?: {
    items?: T[]
  }
}

function unwrapItems<T>(response: ItemsWebApiResult<T>): T[] {
  if (response?.code != null && response.code !== 0) {
    throw new Error(response.msg || '资源请求失败')
  }
  return response?.data?.items || []
}

function adaptResourceItem(item: ResourceListRecord): FrontendResourceItem | null {
  const key = item?.model?.key
  if (!key) {
    return null
  }
  return {
    key,
    fileName: item.model?.fileName || key.split('/').pop() || key,
    contentType: item.model?.contentType,
    directory: item.model?.directory,
    size: item.size,
    lastModifiedTime: item.lastModifiedTime,
  }
}

export async function fetchDevFrontendResourceDirectories(
  url: string,
): Promise<ResourceBrowserDirectoryOption[]> {
  const response = await axios.get<ItemsWebApiResult<ResourceBrowserDirectoryOption>>(url)
  return unwrapItems(response.data)
}

export async function fetchDevFrontendResources(
  url: string,
  params: {
    directory?: string
    keyword?: string
  },
): Promise<FrontendResourceItem[]> {
  const response = await axios.get<ItemsWebApiResult<ResourceListRecord>>(url, {
    params: {
      directory: params.directory || undefined,
      keyword: params.keyword || undefined,
    },
  })
  return unwrapItems(response.data)
    .map(adaptResourceItem)
    .filter((item): item is FrontendResourceItem => !!item)
}

export function buildMissingFrontendResourceItem(key: string): FrontendResourceItem {
  return {
    key,
    fileName: key.split('/').pop() || key,
    isMissing: true,
  }
}
