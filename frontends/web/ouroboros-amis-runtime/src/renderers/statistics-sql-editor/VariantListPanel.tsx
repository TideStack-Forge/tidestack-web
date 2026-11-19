import React from 'react'
import Button from 'amis-ui/lib/components/Button'
import InputBox from 'amis-ui/lib/components/InputBox'

import { extractRendererValue, formatTagInput, normalizeString } from './utils'
import type { StatisticsSqlVariant } from './types'

interface VariantListPanelProps {
  render: any
  language?: string
  disabled: boolean
  variants: StatisticsSqlVariant[]
  activeVariantName: string
  onSelectVariant(variantName: string): void
  onAddVariant(): void
  onRemoveVariant(variantName: string): void
  onVariantChange(variantName: string, patch: Partial<StatisticsSqlVariant>): void
}

export default function VariantListPanel(props: VariantListPanelProps) {
  const {
    activeVariantName,
    disabled,
    language = 'sql',
    onAddVariant,
    onRemoveVariant,
    onSelectVariant,
    onVariantChange,
    render,
    variants,
  } = props
  const activeVariant =
    variants.find((item) => item.variantName === activeVariantName) || variants[0]

  return (
    <section>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}>
        <h5 className="m-t-none m-b-none">方言变体</h5>
        <Button type="button" size="sm" disabled={disabled} onClick={onAddVariant}>
          添加变体
        </Button>
      </div>
      <div
        role="group"
        aria-label="SQL 方言变体"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '16px',
        }}>
        {variants.map((variant) => {
          const isActive = variant.variantName === activeVariant?.variantName
          return (
            <Button
              key={variant.variantName}
              type="button"
              active={isActive}
              disabled={disabled}
              onClick={() => onSelectVariant(variant.variantName)}
              size="sm"
              level={isActive ? 'primary' : 'default'}>
              {variant.variantName}
            </Button>
          )
        })}
      </div>
      {!activeVariant ? (
        <div className="text-muted">暂无方言变体</div>
      ) : (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}>
            <div>
              <span className="text-muted">方言 {activeVariant.dialect || '未设置'}</span>
            </div>
            <Button
              type="button"
              size="sm"
              level="danger"
              disabled={disabled}
              onClick={() => onRemoveVariant(activeVariant.variantName)}>
              删除变体
            </Button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px',
              marginBottom: '16px',
            }}>
            <label>
              <span className="block m-b-xs">变体名称</span>
              <InputBox
                type="text"
                value={activeVariant.variantName}
                disabled={disabled}
                onChange={(nextValue) =>
                  onVariantChange(activeVariant.variantName, {
                    variantName: nextValue,
                  })
                }
              />
            </label>
            <label>
              <span className="block m-b-xs">方言</span>
              <InputBox
                type="text"
                value={activeVariant.dialect}
                disabled={disabled}
                onChange={(nextValue) =>
                  onVariantChange(activeVariant.variantName, {
                    dialect: nextValue,
                  })
                }
              />
            </label>
            <label>
              <span className="block m-b-xs">方言版本范围</span>
              <InputBox
                type="text"
                value={activeVariant.dialectVersionRange}
                disabled={disabled}
                placeholder="8.x, 12-16"
                onChange={(nextValue) =>
                  onVariantChange(activeVariant.variantName, {
                    dialectVersionRange: nextValue,
                  })
                }
              />
            </label>
            <label>
              <span className="block m-b-xs">优先级</span>
              <InputBox
                type="number"
                value={
                  activeVariant.priority == null ? '' : String(activeVariant.priority)
                }
                disabled={disabled}
                onChange={(nextValue) =>
                  onVariantChange(activeVariant.variantName, {
                    priority: nextValue ? Number(nextValue) : undefined,
                  })
                }
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              <span className="block m-b-xs">数据源标签</span>
              <InputBox
                type="text"
                value={formatTagInput(activeVariant.datasourceTags)}
                disabled={disabled}
                placeholder="多个标签用逗号分隔"
                onChange={(nextValue) =>
                  onVariantChange(activeVariant.variantName, {
                    datasourceTags: nextValue
                      .split(',')
                      .map((item) => item.trim())
                      .filter((item) => item.length > 0),
                  })
                }
              />
            </label>
          </div>
          {render(
            'statistics-sql-editor-variant-sql',
            {
              type: 'script-editor',
              name: 'statisticsSqlEditorVariantSql',
              label: false,
              language,
              value: activeVariant.sqlText,
              disabled,
              static: disabled,
              size: 'md',
              options: {
                automaticLayout: true,
                minimap: {
                  enabled: false,
                },
              },
            },
            {
              data: {
                statisticsSqlEditorVariantSql: activeVariant.sqlText,
              },
              onChange: (nextValue: any) => {
                onVariantChange(activeVariant.variantName, {
                  sqlText: normalizeString(
                    extractRendererValue(nextValue, 'statisticsSqlEditorVariantSql')
                  ),
                })
              },
            }
          )}
        </div>
      )}
    </section>
  )
}
