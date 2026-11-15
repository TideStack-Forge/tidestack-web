// 应用入口
import { bootstrap } from './bootstrap'
import { installMenuExtensionStoreLifecycle } from './common/menus/registry'
import { initializeMainAppEntry } from './mainAppEntry'

initializeMainAppEntry()
installMenuExtensionStoreLifecycle()
bootstrap()
