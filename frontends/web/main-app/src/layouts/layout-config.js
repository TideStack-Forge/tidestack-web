/**
 * 布局配置
 * 定义不同布局类型的组件组合和位置
 */

export const layoutConfigs = {
  'header-sidebar': {
    header: {
      enabled: true,
      position: 'top', // 'top' | 'content-top'
      showUserMenu: true,
      showToggle: false,
      showSearch: true,
    },
    sidebar: {
      enabled: true,
      position: 'left',
      menuStyle: 'DualModeMenu',
      showBrand: false,
      showSearch: false,
      showUserMenu: false,
      showToggle: true,
    },
    tabs: {
      enabled: true,
      position: 'content-top',
    },
  },

  'sidebar-split': {
    header: {
      enabled: null,
      position: 'content-top',
      showUserMenu: false, // 头部显示用户菜单
      showToggle: false, // 头部显示切换按钮
      showSearch: false,
    },
    sidebar: {
      enabled: true,
      position: 'left',
      menuStyle: 'TreeMenu',
      showBrand: true,
      showSearch: true, // 侧边栏不显示搜索
      showUserMenu: true, // 侧边栏不显示用户菜单
      showToggle: true, // 侧边栏不显示切换按钮
    },
    tabs: {
      enabled: true,
      position: 'content-top',
    },
  },

  'sidebar-split-no-header': {
    header: {
      enabled: false,
    },
    sidebar: {
      enabled: true,
      position: 'left',
      menuStyle: 'TreeMenu',
      showBrand: true,
      showSearch: true,
      showUserMenu: true,
      showToggle: true,
    },
    tabs: {
      enabled: true,
      position: 'content-top',
    },
  },

  'header-only': {
    header: {
      enabled: true,
      position: 'top',
      showUserMenu: true,
      showToggle: false,
      showSearch: true,
    },
    sidebar: {
      enabled: false,
    },
    tabs: {
      enabled: true,
      position: 'content-top',
    },
  },

  fullscreen: {
    header: {
      enabled: false,
    },
    sidebar: {
      enabled: false,
    },
    tabs: {
      enabled: false,
    },
  },
}

/**
 * 获取布局配置
 * @param {string} layoutType - 布局类型
 * @returns {object} 布局配置
 */
export function getLayoutConfig(layoutType) {
  return layoutConfigs[layoutType] || layoutConfigs['header-sidebar']
}

/**
 * 合并自定义配置
 * @param {string} layoutType - 布局类型
 * @param {object} customConfig - 自定义配置
 * @returns {object} 合并后的配置
 */
export function mergeLayoutConfig(layoutType, customConfig = {}) {
  const baseConfig = getLayoutConfig(layoutType)
  
  return {
    header: { ...baseConfig.header, ...customConfig.header },
    sidebar: { ...baseConfig.sidebar, ...customConfig.sidebar },
    tabs: { ...baseConfig.tabs, ...customConfig.tabs },
  }
}
