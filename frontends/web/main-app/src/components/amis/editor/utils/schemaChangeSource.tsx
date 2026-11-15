import React from 'react'

export type SchemaChangeSource = 'code'

export interface SchemaChangeSourceTracker {
  decorateOnBuildPanels(event: unknown): void
  consume(): SchemaChangeSource | undefined
}

const codePanelWrapped = Symbol('ouroboros.codePanelWrapped')

type PanelPropsLike = {
  onChange?: (...args: unknown[]) => unknown
  [key: string]: unknown
}

type PanelLike = {
  key?: string
  component?: React.ComponentType<any>
  render?: (props: PanelPropsLike) => React.ReactElement | null
  [codePanelWrapped]?: boolean
}

function getBuildPanels(event: unknown): PanelLike[] {
  const candidate = event as { data?: unknown; context?: { data?: unknown } }
  const panels = Array.isArray(candidate?.data)
    ? candidate.data
    : candidate?.context?.data
  return Array.isArray(panels) ? (panels as PanelLike[]) : []
}

function withCodeChangeMarker(
  props: PanelPropsLike,
  markCodeChange: () => void
): PanelPropsLike {
  return {
    ...props,
    onChange: (...args: unknown[]) => {
      markCodeChange()
      return props.onChange?.(...args)
    },
  }
}

function decorateCodePanel(panel: PanelLike, markCodeChange: () => void): void {
  if (panel[codePanelWrapped]) return

  const originalRender = panel.render
  const OriginalComponent = panel.component

  if (originalRender) {
    panel.render = (props) => originalRender(withCodeChangeMarker(props, markCodeChange))
    panel[codePanelWrapped] = true
    return
  }

  if (OriginalComponent) {
    const CodeChangeSourcePanel = (props: PanelPropsLike) => (
      <OriginalComponent {...withCodeChangeMarker(props, markCodeChange)} />
    )
    CodeChangeSourcePanel.displayName = `CodeChangeSourcePanel(${
      OriginalComponent.displayName || OriginalComponent.name || 'Panel'
    })`
    panel.component = CodeChangeSourcePanel
    panel[codePanelWrapped] = true
  }
}

export function createSchemaChangeSourceTracker(): SchemaChangeSourceTracker {
  let nextSource: SchemaChangeSource | undefined

  const markCodeChange = () => {
    nextSource = 'code'
  }

  return {
    decorateOnBuildPanels(event) {
      getBuildPanels(event)
        .filter((panel) => panel.key === 'code')
        .forEach((panel) => decorateCodePanel(panel, markCodeChange))
    },
    consume() {
      const source = nextSource
      nextSource = undefined
      return source
    },
  }
}
