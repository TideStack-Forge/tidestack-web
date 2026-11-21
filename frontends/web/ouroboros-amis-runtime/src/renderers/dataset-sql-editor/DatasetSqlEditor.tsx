import React from 'react'
import { Button, FormItem } from 'amis'
import { EventBus } from '#ouroboros-host/common/eventBus'
import statisticsDatasetEditorDirtyGuard from '#ouroboros-host/utils/statisticsDatasetEditorDirtyGuard'
import { Client } from '#ouroboros-host/utils/http'

import {
  buildNextDialectName,
  ensureUniqueDialectName,
  extractRendererValue,
  isSqlEditorValueEqual,
  normalizeDatasourceOptions,
  normalizeSqlEditorValue,
  normalizeString,
} from './utils'
import type {
  DatasetDevConfig,
  DatasetDevConfigEntry,
  DatasetSqlEditorProps,
  DatasetSqlEditorValue,
  DatasetSqlDialect,
} from './types'

const {
  clearStatisticsDatasetEditorDirty,
  isStatisticsDatasetEditorPath,
  markStatisticsDatasetEditorDirty,
} = statisticsDatasetEditorDirtyGuard as {
    clearStatisticsDatasetEditorDirty: (path?: string) => void
    isStatisticsDatasetEditorPath: (path: string) => boolean
    markStatisticsDatasetEditorDirty: (path?: string) => void
  }

const DATASET_EDITOR_SAVED_EVENT = 'statisticsReporting.datasetEditor.saved'
const DATASET_EDITOR_CHANGED_EVENT = 'statisticsReporting.datasetEditor.changed'
const DATASET_EDITOR_INITIALIZED_EVENT = 'statisticsReporting.datasetEditor.initialized'
const BASE_SQL_TAB = '__base_sql__'

interface DatasetSqlEditorState {
  activeTab: string
  hasUnsavedChanges: boolean
  configDialogOpen: boolean
  configSection: 'connection' | 'parameters'
  configLoading: boolean
  configSaving: boolean
  configTesting: boolean
  configError: string
  configLoadError: string
  connectionTestMessage: string
  devConfig: DatasetDevConfig | null
  configDraft: DatasetDevConfig
  parameterRows: DatasetDevConfigEntry[]
  parametersText: string
  parametersAdvancedDirty: boolean
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  marginBottom: '6px',
  color: '#475569',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '38px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  padding: '8px 12px',
  backgroundColor: '#fff',
}

const tabStyle: React.CSSProperties = {
  border: 0,
  borderBottom: '2px solid transparent',
  backgroundColor: 'transparent',
  color: '#475569',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
  padding: '10px 4px 9px',
}

class DatasetSqlEditor extends React.Component<
  DatasetSqlEditorProps,
  DatasetSqlEditorState
> {
  constructor(props: DatasetSqlEditorProps) {
    super(props)
    this.state = {
      activeTab: BASE_SQL_TAB,
      hasUnsavedChanges: false,
      configDialogOpen: false,
      configSection: 'connection',
      configLoading: false,
      configSaving: false,
      configTesting: false,
      configError: '',
      configLoadError: '',
      connectionTestMessage: '',
      devConfig: null,
      configDraft: this.buildDefaultDevConfig(),
      parameterRows: [],
      parametersText: '{}',
      parametersAdvancedDirty: false,
    }
    this.handleDatasourceChange = this.handleDatasourceChange.bind(this)
    this.handleSqlChange = this.handleSqlChange.bind(this)
    this.handleAddDialect = this.handleAddDialect.bind(this)
    this.handleSelectTab = this.handleSelectTab.bind(this)
    this.handleRemoveDialect = this.handleRemoveDialect.bind(this)
    this.handleDialectChange = this.handleDialectChange.bind(this)
    this.handleOpenConfigDialog = this.handleOpenConfigDialog.bind(this)
    this.handleCloseConfigDialog = this.handleCloseConfigDialog.bind(this)
    this.handleSaveDevConfig = this.handleSaveDevConfig.bind(this)
    this.handleTestConnection = this.handleTestConnection.bind(this)
    this.handleDatasetEditorInitialized = this.handleDatasetEditorInitialized.bind(this)
    this.handleDatasetEditorChanged = this.handleDatasetEditorChanged.bind(this)
    this.handleDatasetEditorSaved = this.handleDatasetEditorSaved.bind(this)
    this.handleSaveShortcut = this.handleSaveShortcut.bind(this)
  }

  private configEntrySequence = 0

  private saveShortcutPending = false

  private localValue: DatasetSqlEditorValue | null = null

  private localValueContext = ''

  private localValueSourceSignature = ''

  private localValueDirty = false

  private datasetEditorInitialized = false

  private datasetEditorInitializing = false

  private datasetEditorInitializationTimer: ReturnType<typeof setTimeout> | null = null

  private initialDatasetSignature = ''

  componentDidMount() {
    EventBus.subscribe(
      DATASET_EDITOR_INITIALIZED_EVENT,
      this.handleDatasetEditorInitialized
    )
    EventBus.subscribe(DATASET_EDITOR_CHANGED_EVENT, this.handleDatasetEditorChanged)
    EventBus.subscribe(DATASET_EDITOR_SAVED_EVENT, this.handleDatasetEditorSaved)
    window.addEventListener('keydown', this.handleSaveShortcut, true)
    this.loadDevConfig()
  }

  componentWillUnmount() {
    if (this.datasetEditorInitializationTimer) {
      clearTimeout(this.datasetEditorInitializationTimer)
      this.datasetEditorInitializationTimer = null
    }
    EventBus.unsubscribe(
      DATASET_EDITOR_INITIALIZED_EVENT,
      this.handleDatasetEditorInitialized
    )
    EventBus.unsubscribe(DATASET_EDITOR_CHANGED_EVENT, this.handleDatasetEditorChanged)
    EventBus.unsubscribe(DATASET_EDITOR_SAVED_EVENT, this.handleDatasetEditorSaved)
    window.removeEventListener('keydown', this.handleSaveShortcut, true)
  }

  componentDidUpdate(prevProps: DatasetSqlEditorProps) {
    if (prevProps.value !== this.props.value) {
      const nextActiveTab = this.resolveActiveTab(this.getValue(), this.state.activeTab)
      if (nextActiveTab !== this.state.activeTab) {
        this.setState({
          activeTab: nextActiveTab,
        })
      }
    }
    if (this.getDatasetName(prevProps) !== this.getDatasetName(this.props)) {
      this.loadDevConfig()
    }
  }

  getValue(): DatasetSqlEditorValue {
    const rawQueryDefinition = this.getRawQueryDefinition()
    if (!rawQueryDefinition) {
      this.localValue = null
      this.localValueContext = ''
      this.localValueSourceSignature = ''
      this.localValueDirty = false
      return normalizeSqlEditorValue(this.props.value)
    }

    const context = this.getDatasetValueContext()
    const sourceSignature = this.getRawQueryDefinitionSignature(rawQueryDefinition)
    if (
      !this.localValue ||
      this.localValueContext !== context ||
      (!this.localValueDirty && this.localValueSourceSignature !== sourceSignature)
    ) {
      this.localValue = this.mergeRawQueryDefinition(
        this.props.value,
        rawQueryDefinition
      )
      this.localValueContext = context
      this.localValueSourceSignature = sourceSignature
      this.localValueDirty = false
    }
    return normalizeSqlEditorValue(this.localValue)
  }

  getRawQueryDefinition(props: DatasetSqlEditorProps = this.props): Record<string, any> | null {
    const data = (props.data || {}) as Record<string, any>
    const queryDefinition = data.dataset?.queryDefinition
    if (!queryDefinition || typeof queryDefinition !== 'object') {
      return null
    }
    if (
      typeof queryDefinition.sql !== 'string' &&
      !Array.isArray(queryDefinition.dialects)
    ) {
      return null
    }
    return queryDefinition
  }

  getDatasetValueContext(props: DatasetSqlEditorProps = this.props): string {
    return this.getAppName(props) + '::' + this.getDatasetName(props)
  }

  getRawQueryDefinitionSignature(queryDefinition: Record<string, any>): string {
    return JSON.stringify({
      datasource: queryDefinition.datasource,
      sql: queryDefinition.sql,
      dialects: queryDefinition.dialects,
    })
  }

  mergeRawQueryDefinition(
    value: any,
    rawQueryDefinition: Record<string, any>
  ): DatasetSqlEditorValue {
    const mappedValue = normalizeSqlEditorValue(value)
    return normalizeSqlEditorValue({
      ...mappedValue,
      datasource: rawQueryDefinition.datasource || mappedValue.datasource,
      ...(typeof rawQueryDefinition.sql === 'string'
        ? { sql: rawQueryDefinition.sql }
        : {}),
      ...(Array.isArray(rawQueryDefinition.dialects)
        ? { dialects: rawQueryDefinition.dialects }
        : {}),
    })
  }

  getReadOnly(): boolean {
    return Boolean(this.props.static || this.props.disabled)
  }

  getAppName(props: DatasetSqlEditorProps = this.props): string {
    const data = (props.data || {}) as Record<string, any>
    return data.appName || ''
  }

  getDatasetName(props: DatasetSqlEditorProps = this.props): string {
    const data = (props.data || {}) as Record<string, any>
    return data.dataset?.name || data.datasetName || ''
  }

  getDatasetEditorPath(): string {
    const data = (this.props.data || {}) as Record<string, any>
    const appName = data.appName || ''
    const datasetName = this.getDatasetName()
    if (appName && datasetName) {
      return '/dev/' + appName + '/dataset/' + datasetName
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
    markStatisticsDatasetEditorDirty(this.getDatasetEditorPath())
  }

  emitChange(nextValue: DatasetSqlEditorValue) {
    if (
      !this.datasetEditorInitialized &&
      isStatisticsDatasetEditorPath(this.getDatasetEditorPath())
    ) {
      return
    }
    if (isSqlEditorValueEqual(this.getValue(), nextValue)) {
      return
    }
    this.localValue = normalizeSqlEditorValue(nextValue)
    this.localValueContext = this.getDatasetValueContext()
    this.localValueDirty = true
    this.markUnsavedChanges()
    this.props.onChange?.(nextValue)
  }

  handleDatasourceChange(datasource: string) {
    const nextValue = this.getValue()
    nextValue.datasource = datasource || 'default'
    this.emitChange(nextValue)
  }

  handleSqlChange(sql: string) {
    const nextValue = this.getValue()
    nextValue.sql = sql
    this.emitChange(nextValue)
  }

  handleSelectTab(activeTab: string) {
    const activeDialectName = this.getDialectNameFromTab(activeTab)
    this.setState({
      activeTab,
    })
    this.publishActiveDialectName(activeDialectName)
  }

  handleAddDialect() {
    const nextValue = this.getValue()
    const nextDialectName = buildNextDialectName(nextValue)
    nextValue.dialects = [
      ...nextValue.dialects,
      {
        dialectName: nextDialectName,
        sql: '',
      },
    ]
    this.emitChange(nextValue)
    this.setState({
      activeTab: this.getDialectTabKey(nextDialectName),
    })
    this.publishActiveDialectName(nextDialectName)
  }

  handleRemoveDialect(dialectName: string) {
    const nextValue = this.getValue()
    nextValue.dialects = nextValue.dialects.filter(
      (item) => item.dialectName !== dialectName
    )
    this.emitChange(nextValue)
    this.setState({
      activeTab: BASE_SQL_TAB,
    })
    this.publishActiveDialectName('')
  }

  handleDialectChange(dialectName: string, patch: Partial<DatasetSqlDialect>) {
    const nextValue = this.getValue()
    let updatedDialectName = dialectName
    const nextDialects = nextValue.dialects.map((dialect) => {
      if (dialect.dialectName !== dialectName) {
        return dialect
      }
      const nextDialect = {
        ...dialect,
        ...patch,
      }
      if (patch.dialectName != null) {
        nextDialect.dialectName = ensureUniqueDialectName(
          patch.dialectName,
          nextValue.dialects,
          dialectName
        )
        updatedDialectName = nextDialect.dialectName
      }
      return nextDialect
    })
    nextValue.dialects = nextDialects
    this.emitChange(nextValue)
    if (patch.dialectName != null) {
      this.setState({
        activeTab: this.getDialectTabKey(updatedDialectName),
      })
      this.publishActiveDialectName(updatedDialectName)
    }
  }

  publishActiveDialectName(dialectName: string) {
    if (typeof this.props.dispatchEvent === 'function') {
      void this.props.dispatchEvent('dialectChange', { dialectName })
    }
  }

  handleDatasetEditorChanged(eventData: any) {
    if (!this.datasetEditorInitialized || this.datasetEditorInitializing) {
      return
    }
    const changedDatasetName =
      eventData && typeof eventData.datasetName === 'string' ? eventData.datasetName : ''
    const currentDatasetName = this.getDatasetName()
    if (
      changedDatasetName &&
      currentDatasetName &&
      changedDatasetName !== currentDatasetName
    ) {
      return
    }
    const changedDatasetSignature = this.getDatasetSignature(eventData?.dataset)
    if (
      this.initialDatasetSignature &&
      changedDatasetSignature &&
      changedDatasetSignature === this.initialDatasetSignature
    ) {
      return
    }
    this.markUnsavedChanges()
  }

  handleDatasetEditorInitialized(eventData: any) {
    const initializedDatasetName =
      eventData && typeof eventData.datasetName === 'string' ? eventData.datasetName : ''
    const currentDatasetName = this.getDatasetName()
    if (
      initializedDatasetName &&
      currentDatasetName &&
      initializedDatasetName !== currentDatasetName
    ) {
      return
    }
    this.datasetEditorInitialized = false
    this.datasetEditorInitializing = true
    if (this.datasetEditorInitializationTimer) {
      clearTimeout(this.datasetEditorInitializationTimer)
    }
    this.datasetEditorInitializationTimer = setTimeout(() => {
      this.initialDatasetSignature = this.getDatasetSignature()
      this.datasetEditorInitialized = true
      this.datasetEditorInitializing = false
      this.datasetEditorInitializationTimer = null
    }, 0)
  }

  handleDatasetEditorSaved(eventData: any) {
    if (this.datasetEditorInitializing) {
      return
    }
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
    clearStatisticsDatasetEditorDirty(this.getDatasetEditorPath())
    this.localValueDirty = false
    this.initialDatasetSignature = this.getDatasetSignature()
    if (this.state.hasUnsavedChanges) {
      this.setState({
        hasUnsavedChanges: false,
      })
    }
  }

  getDatasetSignature(dataset?: any) {
    const value = dataset ?? (this.props.data || {}).dataset
    if (!value || typeof value !== 'object') {
      return ''
    }
    const normalized = {
      ...value,
      tags: Array.isArray(value.tags) ? value.tags : [],
      schema:
        value.schema && typeof value.schema === 'object'
          ? {
              ...value.schema,
              fields: Array.isArray(value.schema.fields)
                ? value.schema.fields.map((field: any) => ({
                    ...field,
                    nullable: field.nullable !== false,
                    exportable: field.exportable !== false,
                    visibleByDefault: field.visibleByDefault !== false,
                  }))
                : [],
            }
          : value.schema,
    }
    return JSON.stringify(this.sortSignatureValue(normalized))
  }

  sortSignatureValue(value: any): any {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortSignatureValue(item))
    }
    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce(
          (result, key) => {
            result[key] = this.sortSignatureValue(value[key])
            return result
          },
          {} as Record<string, any>
        )
    }
    return value
  }

  async handleSaveShortcut(event: KeyboardEvent) {
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.altKey ||
      event.shiftKey ||
      (!event.ctrlKey && !event.metaKey) ||
      event.key.toLowerCase() !== 's' ||
      this.getReadOnly() ||
      this.state.configDialogOpen ||
      this.saveShortcutPending ||
      !this.state.hasUnsavedChanges
    ) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (typeof this.props.dispatchEvent === 'function') {
      this.saveShortcutPending = true
      try {
        await this.props.dispatchEvent('saveShortcut', {})
      } finally {
        this.saveShortcutPending = false
      }
    }
  }

  getDevConfigUrl(): string {
    const appName = this.getAppName()
    const datasetName = this.getDatasetName()
    if (!appName || !datasetName) {
      return ''
    }
    return (
      '/api/dev/' +
      encodeURIComponent(appName) +
      '/dataset/' +
      encodeURIComponent(datasetName) +
      '/dev-config'
    )
  }

  buildDefaultDevConfig(): DatasetDevConfig {
    return {
      datasource: this.getValue().datasource || 'default',
      parameters: {},
      testConnection: { kind: 'application' },
    }
  }

  normalizeDevConfig(value: any): DatasetDevConfig {
    const config = value && typeof value === 'object' ? value : {}
    return {
      appName: normalizeString(config.appName),
      datasetName: normalizeString(config.datasetName),
      datasource:
        normalizeString(config.datasource).trim() ||
        this.getValue().datasource ||
        'default',
      parameters:
        config.parameters && typeof config.parameters === 'object'
          ? config.parameters
          : {},
      testConnection: config.testConnection || { kind: 'application' },
    }
  }

  async loadDevConfig() {
    const url = this.getDevConfigUrl()
    if (!url) {
      return
    }
    this.setState({
      configLoading: true,
      configError: '',
      configLoadError: '',
    })
    try {
      const response = await Client.get(url, {}, { isSilent: true })
      if (!response.data || response.data.code !== 0) {
        throw new Error(response.data?.msg || '开发态连接配置读取失败')
      }
      const nextConfig = this.normalizeDevConfig(response.data.data)
      this.setState({
        devConfig: nextConfig,
        configLoading: false,
        configLoadError: '',
      })
    } catch (error: any) {
      this.setState({
        configLoading: false,
        configLoadError: error?.message || '开发态连接配置读取失败',
      })
    }
  }

  handleOpenConfigDialog(section: 'connection' | 'parameters' = 'connection') {
    const config = this.state.devConfig || this.buildDefaultDevConfig()
    this.setState({
      configDialogOpen: true,
      configSection: section,
      configDraft: {
        ...config,
        testConnection: { ...(config.testConnection || { kind: 'application' }) },
        parameters: {
          ...(config.parameters || {}),
        },
      },
      parameterRows: this.objectToEntries(config.parameters || {}),
      parametersText: this.formatJson(config.parameters || {}),
      parametersAdvancedDirty: false,
      configError: this.state.configLoadError,
      connectionTestMessage: '',
    })
  }

  handleCloseConfigDialog() {
    if (this.state.configSaving) {
      return
    }
    this.setState({
      configDialogOpen: false,
      configError: '',
    })
  }

  async handleSaveDevConfig() {
    const url = this.getDevConfigUrl()
    if (!url) {
      this.setState({
        configError: '缺少应用或数据集上下文，无法保存开发态连接配置',
      })
      return
    }
    const parsedParameters = this.state.parametersAdvancedDirty
      ? this.parseJsonObject(this.state.parametersText, '预览参数')
      : this.entriesToObject(this.state.parameterRows, '预览参数')
    if (!parsedParameters.ok) {
      this.setState({
        configError: parsedParameters.message,
      })
      return
    }
    const draft = this.state.configDraft
    const payload: DatasetDevConfig = {
      datasource: this.getValue().datasource || 'default',
      parameters: parsedParameters.value,
      testConnection: draft.testConnection || { kind: 'application' },
    }

    this.setState({
      configSaving: true,
      configError: '',
    })
    try {
      const response = await Client.put(url, payload, { isSilent: true })
      if (!response.data || response.data.code !== 0) {
        throw new Error(response.data?.msg || '开发态连接配置保存失败')
      }
      const nextConfig = this.normalizeDevConfig(response.data.data)
      this.setState({
        configSaving: false,
        configDialogOpen: false,
        devConfig: nextConfig,
        configLoadError: '',
      })
    } catch (error: any) {
      this.setState({
        configSaving: false,
        configError: error?.message || '开发态连接配置保存失败',
      })
    }
  }

  async handleTestConnection() {
    const appName = this.getAppName()
    if (!appName) {
      this.setState({ configError: '缺少应用上下文，无法测试连接' })
      return
    }
    const draft = this.state.configDraft
    this.setState({
      configTesting: true,
      configError: '',
      connectionTestMessage: '',
    })
    try {
      const response = await Client.post(
        '/api/dev/' + encodeURIComponent(appName) + '/dataset/test-connection',
        {
          datasource: this.getValue().datasource || 'default',
          testConnection: draft.testConnection || { kind: 'application' },
        },
        { isSilent: true }
      )
      if (!response.data || response.data.code !== 0) {
        throw new Error(response.data?.msg || '连接测试失败')
      }
      this.setState({
        configTesting: false,
        connectionTestMessage: '连接成功',
      })
    } catch (error: any) {
      this.setState({
        configTesting: false,
        configError: error?.message || '连接测试失败',
      })
    }
  }

  updateConfigDraft(patch: Partial<DatasetDevConfig>) {
    this.setState((previousState) => ({
      configDraft: {
        ...previousState.configDraft,
        ...patch,
      },
    }))
  }

  objectToEntries(value: Record<string, any>): DatasetDevConfigEntry[] {
    return Object.entries(value || {}).map(([key, entryValue]) => ({
      id: 'dev-config-entry-' + ++this.configEntrySequence,
      key,
      value: typeof entryValue === 'string' ? entryValue : JSON.stringify(entryValue),
    }))
  }

  entriesToObject(
    entries: DatasetDevConfigEntry[],
    label: string
  ): { ok: true; value: Record<string, any> } | { ok: false; message: string } {
    const result: Record<string, any> = {}
    for (const entry of entries) {
      const key = entry.key.trim()
      if (!key && !entry.value.trim()) {
        continue
      }
      if (!key) {
        return { ok: false, message: label + '的键不能为空' }
      }
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        return { ok: false, message: label + '存在重复键：' + key }
      }
      result[key] = this.parseEntryValue(entry.value)
    }
    return { ok: true, value: result }
  }

  parseEntryValue(value: string): any {
    const normalized = value == null ? '' : value
    if (!normalized.trim()) {
      return ''
    }
    try {
      return JSON.parse(normalized)
    } catch {
      return normalized
    }
  }

  updateEntryRows(rows: DatasetDevConfigEntry[]) {
    const parsed = this.entriesToObject(rows, '预览参数')
    this.setState({
      parameterRows: rows,
      parametersAdvancedDirty: false,
      ...(parsed.ok ? { parametersText: this.formatJson(parsed.value) } : {}),
    })
  }

  updateEntry(id: string, patch: Partial<DatasetDevConfigEntry>) {
    this.updateEntryRows(this.state.parameterRows.map((entry) =>
      entry.id === id ? { ...entry, ...patch } : entry
    ))
  }

  addEntry() {
    this.updateEntryRows([
      ...this.state.parameterRows,
      { id: 'dev-config-entry-' + ++this.configEntrySequence, key: '', value: '' },
    ])
  }

  removeEntry(id: string) {
    this.updateEntryRows(this.state.parameterRows.filter((entry) => entry.id !== id))
  }

  getDatasourceMismatch(): string {
    const configuredDatasource = normalizeString(this.state.devConfig?.datasource).trim()
    const datasetDatasource = this.getValue().datasource || 'default'
    if (!configuredDatasource || configuredDatasource === datasetDatasource) {
      return ''
    }
    return (
      '开发态配置仍指向 ' +
      configuredDatasource +
      '，当前数据集使用 ' +
      datasetDatasource
    )
  }

  formatJson(value: any): string {
    return JSON.stringify(value && typeof value === 'object' ? value : {}, null, 2)
  }

  parseJsonObject(
    value: string,
    label: string
  ): { ok: true; value: Record<string, any> } | { ok: false; message: string } {
    const text = value && value.trim() ? value : '{}'
    try {
      const parsed = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
          ok: false,
          message: label + '必须是 JSON 对象',
        }
      }
      return {
        ok: true,
        value: parsed,
      }
    } catch (error: any) {
      return {
        ok: false,
        message: label + '不是合法 JSON：' + (error?.message || ''),
      }
    }
  }

  getDatasourceOptions() {
    const datasourceOptions = normalizeDatasourceOptions(this.props.datasourceOptions)
    const options = [
      {
        label: 'default（默认数据源）',
        value: 'default',
      },
      ...datasourceOptions,
    ]
    const seen = new Set<string>()
    return options.filter((option) => {
      if (!option.value || seen.has(option.value)) {
        return false
      }
      seen.add(option.value)
      return true
    })
  }

  hasDatasetContext(): boolean {
    return Boolean(this.getAppName() && this.getDatasetName())
  }

  getDialectTabKey(dialectName: string): string {
    return 'dialect:' + dialectName
  }

  getDialectNameFromTab(tabKey: string): string {
    return tabKey.indexOf('dialect:') === 0 ? tabKey.substring('dialect:'.length) : ''
  }

  resolveActiveTab(value: DatasetSqlEditorValue, currentTab: string): string {
    if (currentTab === BASE_SQL_TAB) {
      return BASE_SQL_TAB
    }
    const currentDialectName = this.getDialectNameFromTab(currentTab)
    if (
      currentDialectName &&
      value.dialects.some((item) => item.dialectName === currentDialectName)
    ) {
      return currentTab
    }
    return BASE_SQL_TAB
  }

  renderBaseSqlTab(value: DatasetSqlEditorValue, readOnly: boolean) {
    return (
      <div style={{ paddingTop: '16px' }}>
        {this.props.render(
          'dataset-sql-editor-sql',
          {
            type: 'script-editor',
            name: 'datasetSqlEditorSql',
            label: false,
            language: 'sql',
            value: '$datasetSqlEditorSql',
            disabled: readOnly,
            static: readOnly,
            size: 'full',
            height: 300,
            options: {
              minimap: {
                enabled: false,
              },
            },
          },
          {
            data: {
              datasetSqlEditorSql: value.sql,
            },
            onChange: (nextValue: any) => {
              this.handleSqlChange(
                normalizeString(extractRendererValue(nextValue, 'datasetSqlEditorSql'))
              )
            },
          }
        )}
      </div>
    )
  }

  renderDialectTab(dialect: DatasetSqlDialect, readOnly: boolean) {
    return (
      <div style={{ paddingTop: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: '16px',
            marginBottom: '16px',
          }}>
          <label style={{ flex: '1 1 260px', maxWidth: '360px' }}>
            <span style={fieldLabelStyle}>方言名称</span>
            <input
              type="text"
              value={dialect.dialectName}
              disabled={readOnly}
              onChange={(event) =>
                this.handleDialectChange(dialect.dialectName, {
                  dialectName: event.target.value,
                })
              }
              style={inputStyle}
            />
          </label>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => this.handleRemoveDialect(dialect.dialectName)}
            style={{
              borderRadius: '8px',
              border: '1px solid #fecaca',
              backgroundColor: readOnly ? '#e2e8f0' : '#fff1f2',
              color: '#be123c',
              padding: '8px 12px',
              fontSize: '12px',
              cursor: readOnly ? 'not-allowed' : 'pointer',
            }}>
            删除方言
          </button>
        </div>
        {this.props.render(
          'dataset-sql-editor-dialect-sql',
          {
            type: 'script-editor',
            name: 'datasetSqlEditorDialectSql',
            label: false,
            language: 'sql',
            value: '$datasetSqlEditorDialectSql',
            disabled: readOnly,
            static: readOnly,
            size: 'full',
            height: 300,
            options: {
              minimap: {
                enabled: false,
              },
            },
          },
          {
            data: {
              datasetSqlEditorDialectSql: dialect.sql,
            },
            onChange: (nextValue: any) => {
              this.handleDialectChange(dialect.dialectName, {
                sql: normalizeString(
                  extractRendererValue(nextValue, 'datasetSqlEditorDialectSql')
                ),
              })
            },
          }
        )}
      </div>
    )
  }

  renderEntryEditor(
    label: string,
    rows: DatasetDevConfigEntry[],
    disabled: boolean
  ) {
    return (
      <section>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
          <span style={{ ...fieldLabelStyle, marginBottom: 0 }}>{label}</span>
          <button
            type="button"
            title={'新增' + label}
            aria-label={'新增' + label}
            disabled={disabled}
            onClick={() => this.addEntry()}
            className="btn btn-default btn-sm">
            <i className="fa fa-plus" aria-hidden="true" />
          </button>
        </div>
        <div style={{ border: '1px solid #dbe2ea', overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
            }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ width: '38%', padding: '8px 10px', textAlign: 'left' }}>
                  键
                </th>
                <th style={{ padding: '8px 10px', textAlign: 'left' }}>值</th>
                <th style={{ width: '46px' }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((entry, index) => (
                <tr key={entry.id}>
                  <td style={{ padding: '6px', borderTop: '1px solid #eef2f7' }}>
                    <input
                      type="text"
                      aria-label={label + '键 ' + (index + 1)}
                      value={entry.key}
                      disabled={disabled}
                      onChange={(event) =>
                        this.updateEntry(entry.id, { key: event.target.value })
                      }
                      style={{ ...inputStyle, minHeight: '34px', padding: '6px 8px' }}
                    />
                  </td>
                  <td style={{ padding: '6px', borderTop: '1px solid #eef2f7' }}>
                    <input
                      type="text"
                      aria-label={label + '值 ' + (index + 1)}
                      value={entry.value}
                      disabled={disabled}
                      onChange={(event) =>
                        this.updateEntry(entry.id, { value: event.target.value })
                      }
                      style={{ ...inputStyle, minHeight: '34px', padding: '6px 8px' }}
                    />
                  </td>
                  <td
                    style={{
                      padding: '6px',
                      borderTop: '1px solid #eef2f7',
                      textAlign: 'center',
                    }}>
                    <button
                      type="button"
                      title={'删除' + label + ' ' + (index + 1)}
                      aria-label={'删除' + label + ' ' + (index + 1)}
                      disabled={disabled}
                      onClick={() => this.removeEntry(entry.id)}
                      className="btn btn-link btn-sm">
                      <i className="fa fa-trash" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? (
            <div
              style={{
                padding: '16px',
                borderTop: '1px solid #eef2f7',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '12px',
              }}>
              暂无配置
            </div>
          ) : null}
        </div>
      </section>
    )
  }

  render() {
    const value = this.getValue()
    const readOnly = this.getReadOnly()
    const datasourceOptions = this.getDatasourceOptions()
    const datasourceValue = value.datasource || 'default'
    const activeDialectName = this.getDialectNameFromTab(this.state.activeTab)
    const activeDialect = value.dialects.find(
      (item) => item.dialectName === activeDialectName
    )

    return (
      <div
        style={{
          display: 'grid',
          gap: '16px',
        }}>
        <div
          style={{
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            backgroundColor: '#fff',
            padding: '16px',
          }}>
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
                margin: '6px 0 4px',
              }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>SQL 查询</h2>
              {this.state.hasUnsavedChanges ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: '6px',
                    backgroundColor: '#fef3c7',
                    color: '#b45309',
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '4px 10px',
                  }}>
                  未保存
                </span>
              ) : null}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px',
              marginBottom: '16px',
            }}>
            <label>
              <span style={fieldLabelStyle}>数据源</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={datasourceValue}
                  disabled={readOnly}
                  onChange={(event) => this.handleDatasourceChange(event.target.value)}
                  style={inputStyle}>
                  {datasourceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {this.hasDatasetContext() ? (
                  <button
                    type="button"
                    title="配置开发态数据源"
                    onClick={() => this.handleOpenConfigDialog()}
                    disabled={this.state.configLoading}
                    style={{
                      width: '38px',
                      minWidth: '38px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#fff',
                      color: '#334155',
                      cursor: 'pointer',
                    }}
                    aria-label="配置开发态数据源">
                    <i className="fa fa-cog" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
          {this.props.render('dataset-table-browser', {
            type: 'button', label: '查看表结构', actionType: 'dialog',
            dialog: {
              title: '数据表与字段', size: 'lg',
              body: {
                type: 'dataset-table-browser',
                appName: this.getAppName(),
                datasource: this.getValue().datasource,
                testConnection: this.state.devConfig?.testConnection,
              },
            },
          })}
          {this.hasDatasetContext() && (
            <Button
              type="button"
              level="link"
              disabled={this.state.configLoading}
              onClick={() => this.handleOpenConfigDialog('parameters')}>
              预览参数
            </Button>
          )}
          </div>

          {this.state.configLoadError ? (
            <div className="alert alert-danger" role="alert">
              {this.state.configLoadError}
            </div>
          ) : null}
          {this.getDatasourceMismatch() ? (
            <div className="alert alert-warning" role="status">
              {this.getDatasourceMismatch()}
            </div>
          ) : null}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              borderBottom: '1px solid #e5e7eb',
            }}>
            <div
              role="tablist"
              aria-label="SQL 定义"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
              }}>
              <button
                type="button"
                role="tab"
                aria-selected={this.state.activeTab === BASE_SQL_TAB}
                onClick={() => this.handleSelectTab(BASE_SQL_TAB)}
                style={{
                  ...tabStyle,
                  borderBottomColor:
                    this.state.activeTab === BASE_SQL_TAB ? '#0f766e' : 'transparent',
                  color: this.state.activeTab === BASE_SQL_TAB ? '#0f172a' : '#475569',
                }}>
                基础 SQL
              </button>
              {value.dialects.map((dialect) => {
                const tabKey = this.getDialectTabKey(dialect.dialectName)
                const isActive = this.state.activeTab === tabKey
                return (
                  <button
                    key={tabKey}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => this.handleSelectTab(tabKey)}
                    style={{
                      ...tabStyle,
                      borderBottomColor: isActive ? '#0f766e' : 'transparent',
                      color: isActive ? '#0f172a' : '#475569',
                    }}>
                    {dialect.dialectName}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              disabled={readOnly}
              onClick={this.handleAddDialect}
              style={{
                flex: '0 0 auto',
                borderRadius: '8px',
                border: '1px solid #0f766e',
                backgroundColor: readOnly ? '#e2e8f0' : '#f8fafc',
                color: '#115e59',
                padding: '8px 12px',
                fontSize: '13px',
                cursor: readOnly ? 'not-allowed' : 'pointer',
              }}>
              新增方言
            </button>
          </div>

          {this.state.activeTab === BASE_SQL_TAB
            ? this.renderBaseSqlTab(value, readOnly)
            : activeDialect
              ? this.renderDialectTab(activeDialect, readOnly)
              : this.renderBaseSqlTab(value, readOnly)}
        </div>
        {this.state.configDialogOpen ? this.renderConfigDialog(readOnly) : null}
      </div>
    )
  }

  renderConfigDialog(readOnly: boolean) {
    const draft = this.state.configDraft
    const isConnection = this.state.configSection === 'connection'
    const title = isConnection ? '开发态数据源配置' : '预览参数'
    return (
      <div
        style={{
          position: 'fixed',
          zIndex: 1200,
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.28)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          style={{
            width: 'min(720px, 100%)',
            maxHeight: '90vh',
            overflow: 'auto',
            borderRadius: '8px',
            border: '1px solid #dbe2ea',
            backgroundColor: '#fff',
            padding: '20px',
          }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>{title}</h3>
            <button
              type="button"
              onClick={this.handleCloseConfigDialog}
              style={{
                border: 0,
                backgroundColor: 'transparent',
                color: '#475569',
                cursor: 'pointer',
                fontSize: '18px',
              }}
              aria-label="关闭">
              ×
            </button>
          </div>

          {this.state.configError ? (
            <div
              style={{
                borderRadius: '8px',
                border: '1px solid #fecaca',
                backgroundColor: '#fff1f2',
                color: '#be123c',
                padding: '10px 12px',
                marginBottom: '12px',
                fontSize: '13px',
              }}>
              {this.state.configError}
            </div>
          ) : null}
          {this.state.connectionTestMessage ? (
            <div className="alert alert-success" role="status">
              {this.state.connectionTestMessage}
            </div>
          ) : null}

          <div style={{ display: 'grid', gap: '12px' }}>
            {isConnection && this.props.render('connection-picker', {
              type: 'form',
              wrapWithPanel: false,
              actions: [],
              formLazyChange: false,
              lazyChange: false,
              data: { testConnection: draft.testConnection || { kind: 'application' } },
              onChange: (data: any) => this.updateConfigDraft({ testConnection: data.testConnection }),
              body: [
                { type: 'static', label: '逻辑数据源', value: this.getValue().datasource || 'default' },
                {
                  type: 'select', name: 'testConnection.kind', label: '预览连接',
                  visibleOn: (this.getValue().datasource || 'default') === 'default',
                  clearable: false,
                  options: [
                    { label: '应用绑定连接', value: 'application' },
                    { label: '平台保存连接', value: 'platform' },
                    { label: '应用运行容器', value: 'runtime' },
                  ],
                },
                {
                  type: 'select', name: 'testConnection.platformDataSourceName', label: '平台连接',
                  visibleOn: "${testConnection.kind == 'platform'}", required: true,
                  source: '/api/dev/' + encodeURIComponent(this.getAppName()) + '/dataset/test-connections/platform',
                },
                {
                  type: 'select', name: 'testConnection.envName', label: '连接环境',
                  visibleOn: "${testConnection.kind == 'platform'}", required: true,
                  source: {
                    method: 'get',
                    url: '/api/dev/' + encodeURIComponent(this.getAppName())
                      + '/dataset/test-connections/platform/${testConnection.platformDataSourceName}/environments',
                    sendOn: "${testConnection.kind == 'platform' && !!testConnection.platformDataSourceName}",
                  },
                },
                {
                  type: 'select', name: 'testConnection.runtimeId', label: '运行容器',
                  visibleOn: "${testConnection.kind == 'runtime'}", required: true,
                  source: '/api/dev/' + encodeURIComponent(this.getAppName()) + '/dataset/test-connections/runtime',
                },
              ],
            }, { disabled: readOnly || this.state.configSaving })}
            {!isConnection && this.renderEntryEditor(
              '预览参数',
              this.state.parameterRows,
              readOnly || this.state.configSaving
            )}
            {!isConnection && <details style={{ borderTop: '1px solid #e5e7eb', paddingTop: '10px' }}>
              <summary
                style={{
                  cursor: 'pointer',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 600,
                }}>
                高级 JSON
              </summary>
              <div style={{ display: 'grid', gap: '12px', paddingTop: '12px' }}>
                <label>
                  <span style={fieldLabelStyle}>预览参数 JSON</span>
                  <textarea
                    value={this.state.parametersText}
                    disabled={readOnly || this.state.configSaving}
                    onChange={(event) =>
                      this.setState({
                        parametersText: event.target.value,
                        parametersAdvancedDirty: true,
                      })
                    }
                    style={{
                      ...inputStyle,
                      minHeight: '92px',
                      fontFamily: 'monospace',
                    }}
                  />
                </label>
              </div>
            </details>}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
              marginTop: '18px',
            }}>
            {isConnection && <button
              type="button"
              onClick={this.handleTestConnection}
              disabled={readOnly || this.state.configSaving || this.state.configTesting}
              style={{
                marginRight: 'auto',
                borderRadius: '8px',
                border: '1px solid #0f766e',
                backgroundColor: '#fff',
                color: '#115e59',
                padding: '8px 14px',
              }}>
              {this.state.configTesting ? '测试中...' : '测试连接'}
            </button>}
            <button
              type="button"
              onClick={this.handleCloseConfigDialog}
              disabled={this.state.configSaving}
              style={{
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#fff',
                color: '#334155',
                padding: '8px 14px',
              }}>
              取消
            </button>
            <button
              type="button"
              onClick={this.handleSaveDevConfig}
              disabled={readOnly || this.state.configSaving}
              style={{
                borderRadius: '8px',
                border: '1px solid #0f766e',
                backgroundColor: readOnly ? '#e2e8f0' : '#0f766e',
                color: readOnly ? '#64748b' : '#fff',
                padding: '8px 14px',
              }}>
              {this.state.configSaving ? '保存中...' : isConnection ? '保存配置' : '保存参数'}
            </button>
          </div>
        </div>
      </div>
    )
  }
}

FormItem({
  type: 'dataset-sql-editor',
  autoVar: true,
})(DatasetSqlEditor as any)

export default DatasetSqlEditor
