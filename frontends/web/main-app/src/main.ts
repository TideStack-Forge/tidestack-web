// 应用入口
import { bootstrap } from './bootstrap'
import { installMenuExtensionStoreLifecycle } from './common/menus/registry'
import { initializeMainAppEntry } from './mainAppEntry'
import {
  initScriptEditorIntelligencePlayground,
  isScriptEditorIntelligenceDebugPath,
} from './scriptEditorIntelligencePlayground'
import {
  initDatasetSqlEditorPlayground,
  isDatasetSqlEditorDebugPath,
} from './datasetSqlEditorPlayground'

initializeMainAppEntry()
installMenuExtensionStoreLifecycle()

// 判断是自启动还是作为Iframe嵌入
if (isScriptEditorIntelligenceDebugPath(window.location.pathname)) {
  initScriptEditorIntelligencePlayground()
} else if (isDatasetSqlEditorDebugPath(window.location.pathname)) {
  initDatasetSqlEditorPlayground()
} else {
  bootstrap()
}
