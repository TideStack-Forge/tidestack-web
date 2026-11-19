import React from 'react'

import type { StatisticsParameterHint } from './types'

interface ParameterHintPanelProps {
  hints: StatisticsParameterHint[]
}

export default function ParameterHintPanel(props: ParameterHintPanelProps) {
  const { hints } = props

  return (
    <aside>
      <h5 className="m-t-none m-b-sm">参数引用</h5>
      {!hints.length ? (
        <div className="text-muted">暂无参数</div>
      ) : (
        <ul className="list-unstyled m-b-none">
          {hints.map((hint) => (
            <li key={hint.name} className="m-t-sm">
              <div>
                <code>:{hint.name}</code> {hint.title || hint.name}
                {hint.required ? ' *' : ''}
              </div>
              <div className="text-muted text-sm">
                {hint.type} · 运算符 {hint.operator} · {hint.multiValue ? '多值' : '单值'}{' '}
                · {hint.visibleInView ? '图表中可见' : '图表中隐藏'}
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
