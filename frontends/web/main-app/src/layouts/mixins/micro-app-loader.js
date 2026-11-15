/**
 * 微前端加载 Mixin
 * 用于在布局变体中加载和管理微前端应用
 */
import { loadMicroApp } from 'qiankun'
import { getCommonProps } from '@/common/micro/commonProps'
import {
  createMicroEntryFetch,
  ensureSameOriginMicroEntryIsSafe,
} from '@/common/micro/entryGuard'
import { normalizeMicroEntry } from '@/common/micro/utils'

export default {
  data() {
    return {
      microTopbar: null,
      microSidebar: null,
      microTopbarMounting: false,
      microSidebarMounting: false,
      microAppLoaderDestroyed: false,
    }
  },
  
  computed: {
    headerEntry() {
      return this.$store.getters['app/headerEntry']
    },
    
    sidebarEntry() {
      return this.$store.getters['app/sidebarEntry']
    },
  },
  
  watch: {
    '$route': {
      handler() {
        this.updateMicroApps()
      },
      deep: true,
    },
    
    theme() {
      this.updateMicroApps()
    },
    
    menu: {
      handler() {
        this.updateMicroApps()
      },
      deep: true,
    },
  },
  
  mounted() {
    return this.$nextTick(async () => {
      await this.recheckPendingMicroApps()
    })
  },

  updated() {
    return this.$nextTick(async () => {
      await this.recheckPendingMicroApps()
    })
  },
  
  beforeDestroy() {
    this.microAppLoaderDestroyed = true
    // 卸载微前端
    if (this.microTopbar && typeof this.microTopbar.unmount === 'function') {
      this.microTopbar.unmount()
    }
    if (this.microSidebar && typeof this.microSidebar.unmount === 'function') {
      this.microSidebar.unmount()
    }
    this.microTopbar = null
    this.microSidebar = null
    this.microTopbarMounting = false
    this.microSidebarMounting = false
  },
  
  methods: {
    async recheckPendingMicroApps() {
      await this.loadTopbarMicro()
      await this.loadSidebarMicro()
    },

    // 加载头部微前端
    async loadTopbarMicro() {
      if (!this.headerEntry || this.microTopbar || this.microTopbarMounting || this.microAppLoaderDestroyed) return

      this.microTopbarMounting = true
      
      try {
        await this.$nextTick()
        if (this.microTopbar || this.microAppLoaderDestroyed) return

        const container = document.querySelector('#custom-topbar')
        if (!container) return

        const config = {
          name: 'micro-custom-header',
          container,
          entry: normalizeMicroEntry(this.headerEntry),
          props: this.buildMicroProps(),
        }

        await ensureSameOriginMicroEntryIsSafe(config.entry)
        if (this.microAppLoaderDestroyed) return

        const microApp = loadMicroApp(config, { fetch: createMicroEntryFetch() })
        await microApp.mountPromise

        if (this.microAppLoaderDestroyed) {
          if (typeof microApp.unmount === 'function') {
            microApp.unmount()
          }
          return
        }

        this.microTopbar = microApp
      } catch (e) {
        if (!e?.isUnsafeMicroEntry) {
          console.warn('头部微应用加载失败', e)
        }
      } finally {
        this.microTopbarMounting = false
      }
    },
    
    // 加载侧边栏微前端
    async loadSidebarMicro() {
      if (!this.sidebarEntry || this.microSidebar || this.microSidebarMounting || this.microAppLoaderDestroyed) return

      this.microSidebarMounting = true
      
      try {
        await this.$nextTick()
        if (this.microSidebar || this.microAppLoaderDestroyed) return

        const container = document.querySelector('#custom-sidebar')
        if (!container) return

        const config = {
          name: 'micro-custom-sidebar',
          container,
          entry: normalizeMicroEntry(this.sidebarEntry),
          props: this.buildMicroProps(),
        }

        await ensureSameOriginMicroEntryIsSafe(config.entry)
        if (this.microAppLoaderDestroyed) return

        const microApp = loadMicroApp(config, { fetch: createMicroEntryFetch() })
        await microApp.mountPromise

        if (this.microAppLoaderDestroyed) {
          if (typeof microApp.unmount === 'function') {
            microApp.unmount()
          }
          return
        }

        this.microSidebar = microApp
      } catch (e) {
        if (!e?.isUnsafeMicroEntry) {
          console.warn('侧边栏微应用加载失败', e)
        }
      } finally {
        this.microSidebarMounting = false
      }
    },
    
    // 构建微前端 props
    buildMicroProps() {
      return {
        appName: this.appName,
        logo: this.logo,
        menu: this.menu,
        theme: this.theme,
        userInfo: this.userInfo,
        breadcrumb: this.breadcrumb,
        currentPath: this.$route && this.$route.fullPath ? this.$route.fullPath : '',
        ...getCommonProps(),
      }
    },
    
    // 更新微前端应用
    updateMicroApps() {
      if (
        this.microTopbar &&
        typeof this.microTopbar.getStatus === 'function' &&
        typeof this.microTopbar.update === 'function' &&
        this.microTopbar.getStatus() === 'MOUNTED'
      ) {
        this.microTopbar.update(this.buildMicroProps())
      }
      if (
        this.microSidebar &&
        typeof this.microSidebar.getStatus === 'function' &&
        typeof this.microSidebar.update === 'function' &&
        this.microSidebar.getStatus() === 'MOUNTED'
      ) {
        this.microSidebar.update(this.buildMicroProps())
      }
    },
  },
}
