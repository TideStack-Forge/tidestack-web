/* @vitest-environment jsdom */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const {
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require('../../../../helpers/mainAppTestKit')

let unregisterTypescript
let WorkflowTimeline

beforeAll(() => {
  unregisterTypescript = registerTypescriptRequire()
  ;({ WorkflowTimeline } = requireMirroredSrcModule(__filename, './WorkflowTimeline.tsx'))
})

afterAll(() => {
  unregisterTypescript?.()
})

describe('workflow timeline renderer', () => {
  it('renders the AMIS timeline with the resolved approval instance endpoint', () => {
    const render = vi.fn()
    const component = new WorkflowTimeline({
      data: { instanceId: 'data-instance' },
      instanceId: 'explicit-instance',
      render,
    })

    component.render()

    expect(render).toHaveBeenCalledWith('workflow-timeline', {
      type: 'timeline',
      className: 'workflow-approval-timeline',
      source: {
        method: 'GET',
        url: '/api/approval-workflow/instance/explicit-instance/timeline',
      },
    })
  })

  it('renders nothing before an approval instance is available', () => {
    const render = vi.fn()
    const component = new WorkflowTimeline({ data: {}, render })

    expect(component.render()).toBeNull()
    expect(render).not.toHaveBeenCalled()
  })
})
