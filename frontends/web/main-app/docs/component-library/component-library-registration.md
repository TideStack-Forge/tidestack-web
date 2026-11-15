# 组件库注册机制说明

## 概述

组件库通过正式注册入口加载组件清单（manifest）和管理配置（manage）。本页维护配置、用法与注册行为的共同说明。

## 核心文件

### `src/common/micro/registerComponentLibrary.ts`

`registerComponentLibrary()` 注册单个组件库，并按选项加载 manifest 与 manage 文件；`registerComponentLibraries()` 接受数组与统一选项，返回逐库 settled 结果。

### `src/loadComponentLibrary.ts`

`loadComponentLibraries(componentLibraries)` 批量加载自定义组件库；`loadPlatformComponentLibrary(componentLibraries)` 加载平台组件库，默认加载 manifest，不加载 manage。

## 配置说明

### 组件库配置来源

调用方传入非空数组时使用该数组；显式空数组表示不加载自定义组件库。只有参数为 `null` 或 `undefined` 时，才尝试读取 `/custom-component-libraries.json`；请求失败时按空数组处理。主应用从当前 app store 的配置取值后传入，不再使用 Vuex getter。

配置格式示例：

```json
[
  {
    "name": "my-component-library",
    "entry": "/micro/libs/my-component-library",
    "publicPath": "/my-component-library",
    "loadManifest": true,
    "loadManage": true
  }
]
```

#### 配置项说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 组件库名称 |
| `entry` | string | 是* | 组件库的入口 URL |
| `publicPath` | string | 否 | 组件库的 public path（如果未提供 entry，则使用此值） |
| `loadManifest` | boolean | 否 | 是否加载 components.manifest.json（默认：false） |
| `loadManage` | boolean | 否 | 是否加载 manage.json（默认：false） |

\* `entry` 和 `publicPath` 至少需要提供一个

### 组件清单文件 (components.manifest.json)

当 `loadManifest: true` 时，系统会从组件库的 entry 目录下加载 `components.manifest.json` 文件。

文件格式示例：

```json
{
  "renderers": [
    {
      "name": "custom-chart",
      "label": "自定义图表",
      "description": "支持多种图表类型的可视化组件",
      "tags": ["数据展示", "图表"]
    },
    {
      "name": "custom-table",
      "label": "自定义表格",
      "description": "功能强大的数据表格组件",
      "tags": ["数据展示", "表格"]
    }
  ],
  "formItems": [
    {
      "name": "custom-input",
      "label": "自定义输入框",
      "description": "增强的文本输入组件",
      "tags": ["表单", "输入"]
    }
  ],
  "optionsControls": [
    {
      "name": "custom-options-editor",
      "label": "自定义选项编辑器",
      "description": "用于编辑选项数据的组件",
      "tags": ["编辑器", "配置"]
    }
  ]
}
```

#### 组件描述对象字段

每个组件都是一个对象，包含以下字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 组件名称（唯一标识） |
| `label` | string | 是 | 组件显示标签 |
| `description` | string | 否 | 组件描述信息 |
| `tags` | string[] | 否 | 组件标签，用于分类和搜索 |

#### 组件类型说明

| 类型 | 对应的 AMIS API | 说明 |
|------|----------------|------|
| `renderers` | `@Renderer` | 自定义渲染器组件 |
| `formItems` | `@FormItem` | 表单项组件 |
| `optionsControls` | `@OptionsControl` | 选项控制器组件 |
| `actions` | `registerAction` | 自定义动作 |
| `rules` | `addRule` | 自定义校验规则 |
| `formulas` | 自定义函数 | 自定义公式函数 |
| `rendererEditorPlugins` | - | 渲染器编辑器插件 |
| `actionEditorPlugins` | - | 动作编辑器插件 |
| `validatorEditorPlugins` | - | 校验器编辑器插件 |

支持自定义其他组件类型，只需在 manifest 中添加相应的字段即可。

### 组件管理配置文件 (manage.json)

当 `loadManage: true` 时，系统会从组件库的 entry 目录下加载 `manage.json` 文件。

文件格式示例：

```json
{
  "renderers": {
    "disabled": ["custom-chart", "custom-table"]
  },
  "formItems": {
    "disabled": ["custom-input"]
  },
  "optionsControls": {
    "disabled": []
  },
  "actions": {
    "disabled": ["custom-import-action"]
  },
  "rules": {
    "disabled": []
  },
  "formulas": {
    "disabled": ["custom-currency-format"]
  },
  "rendererEditorPlugins": {
    "disabled": []
  },
  "actionEditorPlugins": {
    "disabled": []
  },
  "validatorEditorPlugins": {
    "disabled": []
  }
}
```

#### 说明

- 每种组件类型都可以配置 `disabled` 数组
- `disabled` 数组中的元素是**字符串**，对应组件对象的 `name` 字段
- 列出的组件将被过滤掉，不会被注册
- 这允许在不修改组件库源码的情况下，动态禁用某些组件

**注意**：`disabled` 数组中的字符串要与 `components.manifest.json` 中组件对象的 `name` 字段完全匹配。

## 工作流程

1. **加载配置**：从 Store 或 JSON 文件加载组件库配置列表
2. **遍历注册**：对每个组件库配置调用 `registerComponentLibrary()`
3. **加载清单**（可选）：如果 `loadManifest: true`，从 entry 目录加载 `components.manifest.json`
4. **加载管理配置**（可选）：如果 `loadManage: true`，从 entry 目录加载 `manage.json`
5. **过滤组件**：根据管理配置中的 disabled 列表过滤清单中的组件
6. **包装注册方法**：通过 `wrapFilteredComponentRegisterProps` 包装 AMIS 注册方法
7. **传递配置**：将包装后的 props 传递给子应用
8. **挂载微应用**：使用 qiankun 的 `loadMicroApp()` 加载组件库
9. **自动拦截**：子应用注册组件时，只有在清单中的组件才会被实际注册

## 使用示例

### 基本用法（不加载配置文件）

```json
{
  "name": "simple-library",
  "entry": "/micro/libs/simple-library"
}
```

这将直接加载组件库，不会读取任何配置文件。

### 加载清单文件

```json
{
  "name": "my-library",
  "entry": "/micro/libs/my-library",
  "loadManifest": true
}
```

这将加载 `/micro/libs/components.manifest.json`，并将组件清单（包含每个组件的 name、label、description、tags 等信息）传递给子应用。

### 加载清单和管理配置

```json
{
  "name": "my-library",
  "entry": "/micro/libs/my-library",
  "loadManifest": true,
  "loadManage": true
}
```

这将：
1. 加载 `/micro/libs/components.manifest.json` 获取组件清单
2. 加载 `/micro/libs/manage.json` 获取禁用列表
3. 过滤掉被禁用的组件
4. 将过滤后的清单传递给子应用

### 子应用使用包装后的注册方法

**重要**：当启用 `loadManifest` 时，主应用会自动包装所有的 AMIS 注册方法。子应用正常注册组件即可，主应用会自动拦截不在清单中的组件。

```javascript
// 子应用的 mount 函数
export async function mount(props) {
  // 使用主应用传递的注册方法（已被包装）
  const { __utils__: { Renderer, FormItem, registerAction, addRule, registerFormula } } = props

  // 注册渲染器 - 会被自动拦截，只有在 manifest.renderers 中的才会实际注册
  @Renderer({ type: 'custom-chart' })
  class CustomChart extends React.Component {
    // 组件实现
  }

  // 注册表单项 - 会被自动拦截
  @FormItem({ type: 'custom-input' })
  class CustomInput extends React.Component {
    // 组件实现
  }

  // 注册自定义动作 - 会被自动拦截，只有在 manifest.actions 中的才会实际注册
  registerAction('custom-export', async (actionConfig, renderer, event) => {
    // 动作实现
  })

  // 注册校验规则 - 会被自动拦截，只有在 manifest.rules 中的才会实际注册
  addRule('isPhone', (values, value) => {
    return /^1[3-9]\d{9}$/.test(value)
  }, '请输入有效的手机号码')

  // 注册公式 - 会被自动拦截，只有在 manifest.formulas 中的才会实际注册
  registerFormula('formatCurrency', function(input) {
    return `¥${Number(input).toFixed(2)}`
  })
}
```

**关键点**：

1. 使用 `props.__utils__` 中的注册方法（推荐）
2. 所有注册方法都会被主应用自动拦截
3. 只有在 manifest 中声明的组件/动作/规则才会被实际注册
4. 子应用无需手动检查 manifest，正常注册即可

## API 参考

### registerComponentLibrary()

注册单个组件库微应用。

```typescript
function registerComponentLibrary(
  libConfig: ComponentLibraryConfig,
  options?: RegisterOptions
): Promise<MicroApp>
```

**参数：**
- `libConfig`: 组件库配置对象
  - `name`: 组件库名称
  - `entry`: 组件库入口 URL
  - `publicPath`: 可选，公共路径
- `options`: 注册选项
  - `loadManifest`: 是否加载 components.manifest.json（默认：false）
  - `loadManage`: 是否加载 manage.json（默认：false）
  - `awaitMount`: 是否等待挂载完成（默认：true）
  - `parentContainerId`: 父容器 ID（默认：'custom-component'）
  - `parentContainer`: 父容器元素（可选，优先于 parentContainerId）

**返回：**
- 返回微应用实例 `MicroApp`

### registerComponentLibraries()

批量注册多个组件库微应用。

```typescript
function registerComponentLibraries(
  libConfigs: ComponentLibraryConfig[],
  options?: RegisterOptions
): Promise<PromiseSettledResult<MicroApp>[]>
```

**参数：**
- `libConfigs`: 组件库配置数组
- `options`: 应用于所有组件库的注册选项（同 registerComponentLibrary）

**返回：**
- 所有注册 Promise 的 settled 结果数组

**示例：**
```typescript
import { registerComponentLibraries } from '@/common/micro/registerComponentLibrary'

const results = await registerComponentLibraries(
  [
    { name: 'lib1', entry: '/micro/libs/lib1' },
    { name: 'lib2', entry: '/micro/libs/lib2' }
  ],
  {
    loadManifest: true,
    awaitMount: true
  }
)

// 检查注册结果
results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`组件库 ${index + 1} 注册成功:`, result.value)
  } else {
    console.error(`组件库 ${index + 1} 注册失败:`, result.reason)
  }
})
```

## 注意事项

1. **容器元素**：确保页面中存在 `#custom-component` 容器元素，或通过 `parentContainerId`/`parentContainer` 指定自定义容器
2. **配置文件路径**：配置文件应放在组件库的 entry 目录下
   - `components.manifest.json` - 组件清单
   - `manage.json` - 管理配置
3. **错误处理**：如果配置文件加载失败，会在控制台输出警告，但不会阻止组件库加载
4. **组件过滤**：启用 `loadManifest` 后，会自动拦截组件注册。如果同时启用 `loadManage`，会先过滤掉被禁用的组件
5. **性能优化**：如果不需要动态配置，建议不启用配置文件加载以提升性能
6. **注册拦截**：使用 `props.__utils__` 中的注册方法，而不是直接从 amis 导入
7. **子应用兼容**：子应用无需修改代码即可支持拦截机制，完全向后兼容

## 迁移指南

如果你有现有的组件库配置，只需在配置文件中添加 `loadManifest` 和 `loadManage` 字段即可：

```diff
{
  "name": "my-library",
  "entry": "/micro/libs/my-library",
+ "loadManifest": true,
+ "loadManage": true
}
```

如果不添加这些字段，组件库将按原有方式加载，不会有任何影响。

## 过滤与注册边界

loadManifest 启用时加载清单；在该路径内按 loadManage 选择是否读取管理配置，并按组件 name 过滤 disabled 集合。注册包装器以 config.name ?? config.type 取得标识，检查清单后调用原始注册函数；被过滤的组件不会通过另一条注册路径重新加入。

实现统一在 [registerComponentLibrary.ts](../../src/common/micro/registerComponentLibrary.ts) 的 filterComponentsManifest 与 wrapFilteredComponentRegisterProps 中维护。扩展组件种类时同步该入口和本页配置说明，不在子应用复制过滤算法。
