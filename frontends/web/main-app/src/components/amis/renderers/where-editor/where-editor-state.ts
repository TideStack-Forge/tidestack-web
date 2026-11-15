import { deserializeWhereToVisualTree, type WhereVisualGroup } from './where-visual-codec'
import {
  resolveWhereEditorMode,
  type WhereEditorModeResolution,
} from './where-mode-resolver'

export type ResolvedWhereEditorState =
  | {
      mode: 'visual'
      reason: null
      rawValue: any
      visualValue: WhereVisualGroup
    }
  | {
      mode: 'raw'
      reason: Exclude<WhereEditorModeResolution['reason'], null>
      rawValue: any
      visualValue: null
    }

export function resolveWhereEditorState(value: any): ResolvedWhereEditorState {
  const modeResolution = resolveWhereEditorMode(value)
  if (modeResolution.mode === 'raw') {
    const reason = modeResolution.reason ?? 'unsupported-shape'
    return {
      mode: 'raw',
      reason,
      rawValue: value,
      visualValue: null,
    }
  }

  try {
    return {
      mode: 'visual',
      reason: null,
      rawValue: value,
      visualValue: deserializeWhereToVisualTree(value),
    }
  } catch (error) {
    return {
      mode: 'raw',
      reason: 'unsupported-shape',
      rawValue: value,
      visualValue: null,
    }
  }
}

export function canSwitchWhereValueToVisual(value: any): boolean {
  return resolveWhereEditorState(value).mode === 'visual'
}

export function getWhereEditorRawModeMessage(reason: ResolvedWhereEditorState['reason']) {
  if (reason === 'list-expression') {
    return '当前表达式使用了列表式 DSL，需继续以原始 JSON 模式编辑。'
  }
  if (reason === 'unsupported-operator') {
    return '当前表达式包含第一版可视化编辑暂不支持的操作符，已保留为原始 JSON 模式。'
  }
  if (reason === 'unsupported-shape') {
    return '当前表达式结构超出第一版可视化支持范围，已保留为原始 JSON 模式。'
  }
  return '当前表达式正在使用原始 JSON 模式。'
}
