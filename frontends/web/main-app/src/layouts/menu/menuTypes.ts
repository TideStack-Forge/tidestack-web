export interface MenuItem {
  key?: string
  title?: string
  displayTitle?: string
  fullName?: string
  name?: string
  router_id?: string
  parentIndex?: number
  path?: string
  url?: string
  fullPath?: string
  icon?: any
  active?: boolean
  parent?: string
  parentId?: string
  showMode?: string
  opened?: boolean
  children?: MenuItem[]
}
