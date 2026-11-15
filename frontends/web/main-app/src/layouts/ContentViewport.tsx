import { isMicro } from '@/common/micro/utils'

import AppLayoutOutlet from './AppLayoutOutlet'

interface ContentViewportProps {
  routeType?: string
}

export function ContentViewport({ routeType }: ContentViewportProps) {
  const isMicroPage = isMicro(routeType)

  return (
    <div className="content-container">
      {isMicroPage ? (
        <div className="micro-page">
          <div id="micro-app"></div>
        </div>
      ) : (
        <div className="internal-page">
          <AppLayoutOutlet className="route-view" />
        </div>
      )}
    </div>
  )
}
