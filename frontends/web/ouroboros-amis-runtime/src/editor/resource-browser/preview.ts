import type { FrontendResourceItem } from './resourceApi'

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']

export function isPreviewableFrontendResource(item: FrontendResourceItem): boolean {
  if (item.isMissing) {
    return false
  }
  if (item.contentType?.startsWith('image/')) {
    return true
  }
  const lowerKey = item.key.toLowerCase()
  return IMAGE_EXTENSIONS.some((extension) => lowerKey.endsWith(extension))
}

export function buildFrontendResourcePreview(
  item: FrontendResourceItem,
  previewUrl: string,
): {
  previewUrl: string
  canPreview: boolean
  title: string
  subtitle: string
} {
  return {
    previewUrl,
    canPreview: isPreviewableFrontendResource(item),
    title: item.fileName || item.key,
    subtitle: item.directory || '<根目录>',
  }
}
