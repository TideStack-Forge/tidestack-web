import React from 'react'
import { OptionsControl, dataMapping, resolveEventData } from 'amis'
import InputTreeControl from 'amis/lib/renderers/Form/InputTree'
import { TreeSelector } from 'amis-ui/lib/components/Tree'

import './InputTree.scss'

interface InputTreePatchOptions {
  autoFillHeight: boolean
  classPrefix: string
  treeProps?: {
    draggable: boolean
    onMove: (dropInfo: any) => unknown
  }
}

function appendClassName(className: unknown, modifier: string) {
  const currentClassName = typeof className === 'string' ? className : ''

  return currentClassName.split(/\s+/).includes(modifier)
    ? currentClassName
    : [currentClassName, modifier].filter(Boolean).join(' ')
}

function patchTreeElement(
  node: React.ReactNode,
  options: InputTreePatchOptions
): React.ReactNode {
  if (!React.isValidElement(node)) {
    return node
  }

  const props = node.props as Record<string, unknown>
  const treeControlClassName = `${options.classPrefix}TreeControl`
  const autoFillHeightClassName = `${treeControlClassName}--autoFillHeight`
  const classNames =
    typeof props.className === 'string' ? props.className.split(/\s+/) : []
  const isTreeControl = node.type === 'div' && classNames.includes(treeControlClassName)
  const isTreeSelector =
    node.type === TreeSelector ||
    (typeof props.onHandleNodeClick === 'function' &&
      Object.prototype.hasOwnProperty.call(props, 'options') &&
      Object.prototype.hasOwnProperty.call(props, 'value'))

  if (isTreeSelector && options.treeProps) {
    return React.cloneElement(node, options.treeProps)
  }

  if (node.props.children === undefined || node.props.children === null) {
    return node
  }

  return React.cloneElement(
    node,
    isTreeControl && options.autoFillHeight
      ? { className: appendClassName(props.className, autoFillHeightClassName) }
      : undefined,
    React.Children.map(node.props.children, (child) => patchTreeElement(child, options))
  )
}

/**
 * Extends AMIS input-tree with fill-height layout and the native Tree drag lifecycle.
 * The base renderer still owns rendering, selection, filtering, and actions.
 */
class OuroborosInputTreeControl extends InputTreeControl {
  render() {
    const {
      autoFillHeight,
      classPrefix = '',
      draggable,
      dispatchEvent,
    } = this.props as any
    const resolvedDraggable =
      typeof draggable === 'string' && draggable.includes('${')
        ? dataMapping(draggable, this.props.data)
        : draggable
    const isDraggable = resolvedDraggable === true || resolvedDraggable === 'true'
    const shouldAutoFillHeight = autoFillHeight === true

    if (!isDraggable && !shouldAutoFillHeight) {
      return super.render()
    }

    return patchTreeElement(super.render(), {
      autoFillHeight: shouldAutoFillHeight,
      classPrefix,
      treeProps: isDraggable
        ? {
            draggable: true,
            onMove: (dropInfo: any) =>
              dispatchEvent('move', resolveEventData(this.props, dropInfo)),
          }
        : undefined,
    }) as React.ReactElement
  }
}

export default OuroborosInputTreeControl

@OptionsControl({
  type: 'input-tree',
  name: 'OuroborosInputTree',
  override: true,
  weight: -200,
})
export class OuroborosInputTree extends OuroborosInputTreeControl {}
