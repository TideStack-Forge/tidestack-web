import AppLayoutOutlet from '../layouts/AppLayoutOutlet'
import { configureRouter } from './engines/routerEngine'
import { readRouterTopology } from './routerTopologyRuntime'
import { readNavigationContext } from './navigationContextRuntime'
import { executeNavigationDecision } from './navigationExecutionRuntime'
import { installNavigationOrchestration } from './navigationOrchestration'

export function installHostRouter() {
  configureRouter({
    readTopology: () => readRouterTopology(AppLayoutOutlet),
    install: (router, updateTitle) => installNavigationOrchestration(
      router, updateTitle, readNavigationContext, executeNavigationDecision
    ),
  })
}
