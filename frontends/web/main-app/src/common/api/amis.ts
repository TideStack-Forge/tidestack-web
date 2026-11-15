import { Client } from '@/utils/http'

export default async function getSchema(schemaId: string) {
  if (!schemaId) {
    throw new Error('schemaId 不能为空')
  }

  const { data } = await Client.get('/api/ui-schema', { path: decodeURI(schemaId) })

  if (data?.code !== 0) {
    throw new Error(data?.msg || '获取页面失败')
  }

  return data.data
}