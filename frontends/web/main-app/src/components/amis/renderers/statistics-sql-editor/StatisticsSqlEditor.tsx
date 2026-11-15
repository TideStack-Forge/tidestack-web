import React from 'react'
import { FormItem } from 'amis'
import InputBox from 'amis-ui/lib/components/InputBox'
import { EventBus } from '@/common/eventBus'
import statisticsStudioDirtyGuard from '@/utils/statisticsStudioDirtyGuard'

import GenericSqlPanel from './GenericSqlPanel'
import ParameterHintPanel from './ParameterHintPanel'
import VariantListPanel from './VariantListPanel'
import {
  buildNextVariantName,
  buildParameterHints,
  ensureUniqueVariantName,
  formatTagInput,
  isSqlEditorValueEqual,
  normalizeDatasourceOptions,
  normalizeSqlEditorValue,
  parseTagInput,
  resolveActiveVariantName,
} from './utils'
import type {
  StatisticsSqlEditorProps,
  StatisticsSqlEditorValue,
  StatisticsSqlVariant,
} from './types'

const { clearStatisticsStudioDirty, markStatisticsStudioDirty } =
  statisticsStudioDirtyGuard as {
    clearStatisticsStudioDirty: (path?: string) => void
    markStatisticsStudioDirty: (path?: string) => void
  }

const DATASET_STUDIO_SAVED_EVENT = 'statisticsReporting.datasetStudio.saved'

interface StatisticsSqlEditorState {
  activeVariantName: string
  hasUnsavedChanges: boolean
}

class StatisticsSqlEditor extends React.Component<
  StatisticsSqlEditorProps,
  StatisticsSqlEditorState
> {
  constructor(props: StatisticsSqlEditorProps) {
    super(props)
    this.state = {
      activeVariantName: resolveActiveVariantName(this.getValue()),
      hasUnsavedChanges: false,
    }
    this.handleDatasourceNameChange = this.handleDatasourceNameChange.bind(this)
    this.handleDatasourceTagsChange = this.handleDatasourceTagsChange.bind(this)
    this.handleGenericSqlChange = this.handleGenericSqlChange.bind(this)
    this.handleAddVariant = this.handleAddVariant.bind(this)
    this.handleSelectVariant = this.handleSelectVariant.bind(this)
    this.handleRemoveVariant = this.handleRemoveVariant.bind(this)
    this.handleVariantChange = this.handleVariantChange.bind(this)
    this.handleDatasetStudioSaved = this.handleDatasetStudioSaved.bind(this)
  }

  componentDidMount() {
    EventBus.subscribe(DATASET_STUDIO_SAVED_EVENT, this.handleDatasetStudioSaved)
  }

  componentWillUnmount() {
    EventBus.unsubscribe(DATASET_STUDIO_SAVED_EVENT, this.handleDatasetStudioSaved)
  }

  componentDidUpdate(prevProps: StatisticsSqlEditorProps) {
    if (prevProps.value !== this.props.value) {
      const nextActiveVariantName = resolveActiveVariantName(
        this.getValue(),
        this.state.activeVariantName
      )
      if (nextActiveVariantName !== this.state.activeVariantName) {
        this.setState({
          activeVariantName: nextActiveVariantName,
        })
      }
    }
  }

  getValue(): StatisticsSqlEditorValue {
    return normalizeSqlEditorValue(this.props.value)
  }

  getReadOnly(): boolean {
    return Boolean(this.props.static || this.props.disabled)
  }

  getDatasetName(): string {
    const data = (this.props.data || {}) as Record<string, any>
    return data.dataset?.name || data.datasetName || ''
  }

  getDatasetStudioPath(): string {
    const data = (this.props.data || {}) as Record<string, any>
    const appName = data.appName || ''
    const datasetName = this.getDatasetName()
    if (appName && datasetName) {
      return '/dev/' + appName + '/analytics/datasets/' + datasetName + '/studio'
    }
    if (typeof window !== 'undefined' && window.location) {
      return window.location.pathname
    }
    return ''
  }

  markUnsavedChanges() {
    if (!this.state.hasUnsavedChanges) {
      this.setState({
        hasUnsavedChanges: true,
      })
    }
    markStatisticsStudioDirty(this.getDatasetStudioPath())
  }

  emitChange(nextValue: StatisticsSqlEditorValue) {
    if (isSqlEditorValueEqual(this.getValue(), nextValue)) {
      return
    }
    this.markUnsavedChanges()
    this.props.onChange?.(nextValue)
  }

  handleDatasourceNameChange(datasourceName: string) {
    const nextValue = this.getValue()
    nextValue.datasourceName = datasourceName
    this.emitChange(nextValue)
  }

  handleDatasourceTagsChange(rawValue: string) {
    const nextValue = this.getValue()
    nextValue.datasourceTags = parseTagInput(rawValue)
    this.emitChange(nextValue)
  }

  handleGenericSqlChange(genericSql: string) {
    const nextValue = this.getValue()
    nextValue.genericSql = genericSql
    this.emitChange(nextValue)
  }

  handleSelectVariant(activeVariantName: string) {
    this.setState({
      activeVariantName,
    })
  }

  handleAddVariant() {
    const nextValue = this.getValue()
    const nextVariantName = buildNextVariantName(nextValue)
    nextValue.variants = [
      ...nextValue.variants,
      {
        variantName: nextVariantName,
        dialect: '',
        dialectVersionRange: '',
        datasourceTags: [],
        priority: nextValue.variants.length + 1,
        sqlText: '',
      },
    ]
    this.emitChange(nextValue)
    this.setState({
      activeVariantName: nextVariantName,
    })
  }

  handleRemoveVariant(variantName: string) {
    const nextValue = this.getValue()
    nextValue.variants = nextValue.variants.filter(
      (item) => item.variantName !== variantName
    )
    const nextActiveVariantName = resolveActiveVariantName(nextValue)
    this.emitChange(nextValue)
    this.setState({
      activeVariantName: nextActiveVariantName,
    })
  }

  handleVariantChange(variantName: string, patch: Partial<StatisticsSqlVariant>) {
    const nextValue = this.getValue()
    let updatedVariantName = variantName
    const nextVariants = nextValue.variants.map((variant) => {
      if (variant.variantName !== variantName) {
        return variant
      }
      const nextVariant = {
        ...variant,
        ...patch,
      }
      if (patch.variantName != null) {
        nextVariant.variantName = ensureUniqueVariantName(
          patch.variantName,
          nextValue.variants,
          variantName
        )
        updatedVariantName = nextVariant.variantName
      }
      return nextVariant
    })
    nextValue.variants = nextVariants
    this.emitChange(nextValue)
    if (patch.variantName != null) {
      const nextActiveVariantName = resolveActiveVariantName(
        nextValue,
        updatedVariantName
      )
      this.setState({
        activeVariantName: nextActiveVariantName,
      })
    }
  }

  handleDatasetStudioSaved(eventData: any) {
    const savedDatasetName =
      eventData && typeof eventData.datasetName === 'string' ? eventData.datasetName : ''
    const currentDatasetName = this.getDatasetName()
    if (
      savedDatasetName &&
      currentDatasetName &&
      savedDatasetName !== currentDatasetName
    ) {
      return
    }
    clearStatisticsStudioDirty(this.getDatasetStudioPath())
    if (this.state.hasUnsavedChanges) {
      this.setState({
        hasUnsavedChanges: false,
      })
    }
  }

  render() {
    const value = this.getValue()
    const readOnly = this.getReadOnly()
    const datasourceOptions = normalizeDatasourceOptions(this.props.datasourceOptions)
    const parameterHints = buildParameterHints(this.props.data)

    return (
      <div
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '24px' }}>
        <div>
          {this.state.hasUnsavedChanges ? (
            <div className="text-warning m-b-sm" role="status">
              未保存
            </div>
          ) : null}
          <GenericSqlPanel
            render={this.props.render}
            language="sql"
            value={value}
            disabled={readOnly}
            datasourceOptions={datasourceOptions}
            onDatasourceNameChange={this.handleDatasourceNameChange}
            onGenericSqlChange={this.handleGenericSqlChange}
          />
        </div>
        {parameterHints.length ? <ParameterHintPanel hints={parameterHints} /> : null}
        <details open={value.variants.length > 0}>
          <summary className="text-muted cursor-pointer">高级查询设置</summary>
          <div className="m-t-md m-b-md">
            <label className="block">
              <span className="block m-b-xs">数据源标签</span>
              <InputBox
                type="text"
                value={formatTagInput(value.datasourceTags)}
                disabled={readOnly}
                placeholder="多个标签用逗号分隔"
                onChange={this.handleDatasourceTagsChange}
              />
            </label>
          </div>
          <VariantListPanel
            render={this.props.render}
            language="sql"
            variants={value.variants}
            activeVariantName={this.state.activeVariantName}
            disabled={readOnly}
            onSelectVariant={this.handleSelectVariant}
            onAddVariant={this.handleAddVariant}
            onRemoveVariant={this.handleRemoveVariant}
            onVariantChange={this.handleVariantChange}
          />
        </details>
      </div>
    )
  }
}

FormItem({
  type: 'statistics-sql-editor',
  autoVar: true,
})(StatisticsSqlEditor as any)

export default StatisticsSqlEditor
