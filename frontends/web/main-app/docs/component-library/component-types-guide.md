# 组件类型完整指南

本文档详细说明了组件库中支持的所有组件类型及其使用方法。

## 支持的组件类型

组件库注册机制支持以下组件类型：

### 1. renderers - 渲染器组件

**对应 AMIS API**: `@Renderer` 装饰器

**用途**: 自定义页面渲染组件，如图表、表格、卡片等

**示例配置**:
```json
{
  "renderers": [
    {
      "name": "custom-chart",
      "label": "自定义图表",
      "description": "支持多种图表类型的可视化组件",
      "tags": ["数据展示", "图表"]
    }
  ]
}
```

**子应用注册示例**:
```typescript
// 方式 1：使用 amis 导出的装饰器（会被主应用拦截）
import { Renderer } from 'amis'

@Renderer({
  type: 'custom-chart',
  name: 'CustomChart'
})
class CustomChartRenderer extends React.Component {
  // 组件实现
}

// 方式 2：使用主应用传递的 Renderer（推荐，更明确）
export async function mount(props) {
  const { __utils__: { Renderer } } = props

  @Renderer({
    type: 'custom-chart',
    name: 'CustomChart'
  })
  class CustomChartRenderer extends React.Component {
    // 组件实现
  }
}
```

**注意**：当启用 `loadManifest` 时，主应用会自动拦截注册方法。只有在 `manifest.renderers` 中声明的组件才会被实际注册。

### 2. formItems - 表单项组件

**对应 AMIS API**: `@FormItem` 装饰器

**用途**: 自定义表单输入组件，如输入框、选择器、日期选择器等

**示例配置**:
```json
{
  "formItems": [
    {
      "name": "custom-input",
      "label": "自定义输入框",
      "description": "增强的文本输入组件",
      "tags": ["表单", "输入"]
    }
  ]
}
```

**子应用注册示例**:
```typescript
import { FormItem } from 'amis'

@FormItem({
  type: 'custom-input',
  name: 'CustomInput'
})
class CustomInputRenderer extends React.Component {
  // 组件实现
}
```

### 3. optionsControls - 选项控制器组件

**对应 AMIS API**: `@OptionsControl` 装饰器

**用途**: 带选项的表单控件，如下拉选择、复选框组、单选框组等

**示例配置**:
```json
{
  "optionsControls": [
    {
      "name": "custom-select",
      "label": "自定义下拉选择",
      "description": "支持搜索和多选的下拉组件",
      "tags": ["表单", "选择"]
    }
  ]
}
```

**子应用注册示例**:
```typescript
import { OptionsControl } from 'amis'

@OptionsControl({
  type: 'custom-select',
  name: 'CustomSelect'
})
class CustomSelectRenderer extends React.Component {
  // 组件实现
}
```

### 4. actions - 自定义动作

**对应 AMIS API**: `registerAction` 函数

**用途**: 自定义操作行为，如导出、导入、打印等

**示例配置**:
```json
{
  "actions": [
    {
      "name": "custom-export",
      "label": "自定义导出",
      "description": "用于数据导出的自定义动作",
      "tags": ["动作", "导出"]
    }
  ]
}
```

**子应用注册示例**:
```typescript
import { registerAction } from 'amis-core'

registerAction('custom-export', async (action, renderer, event) => {
  // 动作实现
  console.log('执行自定义导出')
})
```

### 5. rules - 自定义校验规则

**对应 AMIS API**: `addRule` 函数

**用途**: 自定义表单验证规则

**示例配置**:
```json
{
  "rules": [
    {
      "name": "isPhone",
      "label": "手机号校验",
      "description": "验证中国大陆手机号格式",
      "tags": ["校验", "手机"]
    }
  ]
}
```

**子应用注册示例**:
```typescript
import { addRule } from 'amis'

addRule('isPhone', {
  // 校验规则实现
  validator: (values, value) => {
    return /^1[3-9]\d{9}$/.test(value)
  },
  message: '请输入有效的手机号码'
})
```

### 6. formulas - 自定义公式

**对应 AMIS API**: 自定义函数

**用途**: 在表达式中使用的自定义函数

**示例配置**:
```json
{
  "formulas": [
    {
      "name": "formatCurrency",
      "label": "货币格式化",
      "description": "格式化数字为货币显示",
      "tags": ["公式", "格式化"]
    }
  ]
}
```

**子应用注册示例**:
```typescript
// 通过 props 中的 amisUtils 注册
export async function mount(props) {
  const { __utils__ } = props

  // 注册自定义公式函数
  __utils__.amisUtils.registerFilter('formatCurrency', (input) => {
    return `¥${Number(input).toFixed(2)}`
  })
}
```

### 7. rendererEditorPlugins - 渲染器编辑器插件

**对应 AMIS API**: AMIS 编辑器插件系统

**用途**: 为自定义渲染器提供可视化编辑能力

**示例配置**:
```json
{
  "rendererEditorPlugins": [
    {
      "name": "custom-chart-editor",
      "label": "图表编辑器插件",
      "description": "为自定义图表提供可视化配置",
      "tags": ["编辑器", "图表"]
    }
  ]
}
```

**子应用注册示例**:
```typescript
import { registerEditorPlugin } from 'amis-editor'

registerEditorPlugin({
  rendererName: 'custom-chart',
  name: 'custom-chart-editor',
  // 编辑器配置
  panelTitle: '图表配置',
  panelBody: [
    // 配置项
  ]
})
```

### 8. actionEditorPlugins - 动作编辑器插件

**对应 AMIS API**: AMIS 编辑器动作插件

**用途**: 为自定义动作提供可视化配置界面

**示例配置**:
```json
{
  "actionEditorPlugins": [
    {
      "name": "export-action-editor",
      "label": "导出动作编辑器",
      "description": "配置导出动作的参数",
      "tags": ["编辑器", "动作"]
    }
  ]
}
```

### 9. validatorEditorPlugins - 校验器编辑器插件

**对应 AMIS API**: AMIS 编辑器校验器插件

**用途**: 为自定义校验规则提供可视化配置

**示例配置**:
```json
{
  "validatorEditorPlugins": [
    {
      "name": "phone-validator-editor",
      "label": "手机号校验编辑器",
      "description": "配置手机号校验规则",
      "tags": ["编辑器", "校验"]
    }
  ]
}
```

## 注册拦截机制

### 工作原理

当启用 `loadManifest` 时，主应用会通过 `wrapFilteredComponentRegisterProps` 函数包装所有的 AMIS 注册方法。这样，即使子应用尝试注册不在清单中的组件，也会被自动拦截。

### 拦截的注册方法

以下注册方法会被自动拦截：

| 注册方法 | 对应组件类型 | 拦截规则 |
|---------|------------|---------|
| `Renderer(config)` | renderers | 检查 `config.name ?? config.type` 是否在 manifest.renderers 中 |
| `FormItem(config)` | formItems | 检查 `config.name ?? config.type` 是否在 manifest.formItems 中 |
| `OptionsControl(config)` | optionsControls | 检查 `config.name ?? config.type` 是否在 manifest.optionsControls 中 |
| `registerAction(type, action)` | actions | 检查 `type` 是否在 manifest.actions 中 |
| `addRule(name, fn, msg)` | rules | 检查 `name` 是否在 manifest.rules 中 |
| `registerFormula(name, fn, doc)` | formulas | 检查 `name` 是否在 manifest.formulas 中 |

### 拦截示例

```typescript
// 假设 manifest 中只有 'custom-chart'

// 子应用尝试注册多个组件
export async function mount(props) {
  const { __utils__: { Renderer } } = props

  // ✅ 这个会被注册（在 manifest 中）
  @Renderer({ type: 'custom-chart' })
  class CustomChart extends React.Component {}

  // ❌ 这个不会被注册（不在 manifest 中）
  @Renderer({ type: 'other-chart' })
  class OtherChart extends React.Component {}
}
```

### 优势

1. **零侵入**：子应用无需修改任何代码
2. **安全可控**：完全由主应用配置控制注册范围
3. **透明拦截**：被拦截的注册不会报错，只是不生效
4. **灵活配置**：通过修改配置文件即可调整注册范围

## 完整使用示例

### 组件库配置文件

**custom-component-libraries.json**:
```json
[
  {
    "name": "my-component-library",
    "entry": "/micro/libs/my-component-library",
    "loadManifest": true,
    "loadManage": true
  }
]
```

### 组件清单文件

**/micro/libs/my-component-library/components.manifest.json**:
```json
{
  "renderers": [
    {
      "name": "custom-chart",
      "label": "自定义图表",
      "description": "支持多种图表类型",
      "tags": ["数据展示", "图表"]
    }
  ],
  "formItems": [
    {
      "name": "custom-input",
      "label": "自定义输入框",
      "description": "增强的文本输入",
      "tags": ["表单", "输入"]
    }
  ],
  "actions": [
    {
      "name": "custom-export",
      "label": "自定义导出",
      "description": "数据导出功能",
      "tags": ["动作", "导出"]
    }
  ],
  "rules": [
    {
      "name": "isPhone",
      "label": "手机号校验",
      "description": "验证手机号格式",
      "tags": ["校验"]
    }
  ]
}
```

### 管理配置文件

**/micro/libs/my-component-library/manage.json**:
```json
{
  "renderers": {
    "disabled": []
  },
  "formItems": {
    "disabled": []
  },
  "actions": {
    "disabled": []
  },
  "rules": {
    "disabled": []
  }
}
```

### 子应用注册代码

```typescript
import React from 'react'

// 1. 注册渲染器和表单项（使用主应用传递的注册方法）
export async function bootstrap(props) {
  const { __utils__: { Renderer, FormItem } } = props

  // 注册渲染器 - 会被自动拦截，只有在 manifest 中的才会实际注册
  @Renderer({
    type: 'custom-chart',
    name: 'CustomChart'
  })
  class CustomChartRenderer extends React.Component {
    render() {
      return <div>自定义图表</div>
    }
  }

  // 注册表单项 - 会被自动拦截
  @FormItem({
    type: 'custom-input',
    name: 'CustomInput'
  })
  class CustomInputRenderer extends React.Component {
    render() {
      return <input type="text" />
    }
  }
}

// 2. 微应用挂载时注册动作和规则
export async function mount(props) {
  const { __utils__: { registerAction, addRule } } = props

  // 注册自定义动作 - 会被自动拦截，只有在 manifest.actions 中的才会实际注册
  registerAction('custom-export', async (actionConfig, renderer, event) => {
    console.log('执行导出:', actionConfig)
    // 实现导出逻辑
  })

  // 注册校验规则 - 会被自动拦截，只有在 manifest.rules 中的才会实际注册
  addRule('isPhone', (values, value) => {
    return /^1[3-9]\d{9}$/.test(value)
  }, '请输入有效的手机号码')
}
```

**关键点**：

1. 使用 `props.__utils__` 中的注册方法（而不是直接从 amis 导入）
2. 所有注册方法都会被主应用自动拦截
3. 只有在 manifest 中声明的组件/动作/规则才会被实际注册
4. 子应用无需关心过滤逻辑，正常注册即可

## 最佳实践

### 1. 推荐使用主应用传递的注册方法

```typescript
// ✅ 推荐：使用 props.__utils__ 中的方法
export async function mount(props) {
  const { __utils__: { Renderer, registerAction } } = props

  @Renderer({ type: 'my-component' })
  class MyComponent extends React.Component {}

  registerAction('my-action', async () => {})
}

// ⚠️ 不推荐：直接从 amis 导入（虽然也会被拦截）
import { Renderer, registerAction } from 'amis'
// 这种方式也会被拦截，但不够明确
```

### 2. 利用拦截机制简化代码

由于主应用会自动拦截，子应用无需判断是否应该注册：

```typescript
// ❌ 不需要这样写
export async function mount(props) {
  const { componentManifest, __utils__: { Renderer } } = props

  // 不需要手动检查 manifest
  if (componentManifest?.renderers?.find(r => r.name === 'my-component')) {
    @Renderer({ type: 'my-component' })
    class MyComponent extends React.Component {}
  }
}

// ✅ 直接注册即可，主应用会自动拦截
export async function mount(props) {
  const { __utils__: { Renderer } } = props

  @Renderer({ type: 'my-component' })
  class MyComponent extends React.Component {}
}
```

### 2. 利用组件元数据

```typescript
componentManifest.renderers?.forEach(component => {
  console.log(`注册: ${component.label}`)
  console.log(`描述: ${component.description}`)
  console.log(`标签: ${component.tags.join(', ')}`)

  // 可以根据 tags 进行分组
  if (component.tags.includes('图表')) {
    registerChartComponent(component)
  }
})
```

### 3. 动态禁用组件

通过修改 `manage.json` 文件，无需修改代码即可禁用组件：

```json
{
  "renderers": {
    "disabled": ["custom-timeline", "custom-card"]
  }
}
```

### 4. 版本控制

在组件描述中添加版本信息：

```json
{
  "name": "custom-chart",
  "label": "自定义图表 v2.0",
  "description": "支持多种图表类型",
  "tags": ["数据展示", "图表"],
  "version": "2.0.0",
  "deprecated": false
}
```

## 常见问题

### Q: 如何添加自定义组件类型？

A: 只需在 `components.manifest.json` 中添加新的字段即可：

```json
{
  "renderers": [...],
  "myCustomType": [
    {
      "name": "my-component",
      "label": "我的组件",
      "description": "自定义类型组件"
    }
  ]
}
```

### Q: disabled 数组中的值是什么？

A: 是组件对象的 `name` 字段值（字符串）：

```json
{
  "myCustomType": {
    "disabled": ["my-component"]
  }
}
```

### Q: 如何在编辑器中使用这些组件？

A: 需要额外注册对应的编辑器插件（`rendererEditorPlugins` 等）。

## 相关文档

- [组件库注册详细文档](./component-library-registration.md)
- [组件库注册机制](component-library-registration.md)
- [AMIS 官方文档](https://aisuda.bce.baidu.com/amis/zh-CN/docs/index)
