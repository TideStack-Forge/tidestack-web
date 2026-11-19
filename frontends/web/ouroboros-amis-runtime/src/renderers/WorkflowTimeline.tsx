import { Renderer, type RendererProps } from 'amis'
import React from 'react'
import './WorkflowTimeline.scss'

interface WorkflowTimelineProps extends RendererProps {
  instanceId?: string
}

export class WorkflowTimeline extends React.Component<WorkflowTimelineProps> {
  render() {
    const { data = {}, instanceId, render } = this.props
    const resolvedInstanceId = instanceId || data.instanceId

    if (!resolvedInstanceId) {
      return null
    }

    return render('workflow-timeline', {
      type: 'timeline',
      className: 'workflow-approval-timeline',
      source: {
        method: 'GET',
        url: `/api/approval-workflow/instance/${resolvedInstanceId}/timeline`,
      },
    })
  }
}

Renderer({ type: 'workflow-timeline', autoVar: true })(WorkflowTimeline as any)

export default WorkflowTimeline
