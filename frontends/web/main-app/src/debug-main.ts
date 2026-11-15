import { bootstrap } from './bootstrap'
import {
  initAmisTooltipPatchPlayground,
  isAmisTooltipPatchDebugPath,
} from './amisTooltipPatchPlayground'
import { initializeMainAppEntry } from './mainAppEntry'
import {
  initScriptEditorIntelligencePlayground,
  isScriptEditorIntelligenceDebugPath,
} from './scriptEditorIntelligencePlayground'
import {
  initStatisticsSqlEditorPlayground,
  isStatisticsSqlEditorDebugPath,
} from './statisticsSqlEditorPlayground'

const debugPlaygrounds = [
  {
    isPath: isAmisTooltipPatchDebugPath,
    init: initAmisTooltipPatchPlayground,
  },
  {
    isPath: isScriptEditorIntelligenceDebugPath,
    init: initScriptEditorIntelligencePlayground,
  },
  {
    isPath: isStatisticsSqlEditorDebugPath,
    init: initStatisticsSqlEditorPlayground,
  },
]

initializeMainAppEntry()

const playground = debugPlaygrounds.find(({ isPath }) => isPath(window.location.pathname))

if (playground) {
  playground.init()
} else {
  bootstrap()
}
