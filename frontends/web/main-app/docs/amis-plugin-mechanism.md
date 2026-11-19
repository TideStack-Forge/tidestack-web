# AMIS 编辑器插件机制深度解析

> 前七节的第三方内部流程和类型片段是机制示意，并非复制当前依赖的完整源码；准确签名以锁文件选定的 amis-editor / amis-editor-core 类型为准。本轮未安装依赖核验第三方内部实现。第八节以后说明仓库当前 patch 职责。

## 一、核心机制

### 1.1 插件收集流程

AMIS 编辑器通过 `collectPanels` 方法收集所有插件的配置面板：

```typescript
// amis-editor-core/src/manager.ts
collectPanels(node: EditorNodeType) {
  let panels: Array<BasicPanelItem> = [];
  
  // 关键：遍历所有已注册的插件
  this.plugins.forEach(editor => {
    editor.buildEditorPanel?.(context, panels);
  });
  
  return panels;
}
```

**关键发现**：
- 所有插件的 `buildEditorPanel` 方法都会被调用
- 所有插件共享同一个 `panels` 数组
- 多个插件可以为同一个组件添加配置面板

### 1.2 插件协同工作原理

```typescript
// 插件 A - 提供基础配置
class PluginA extends FileControlPlugin {
  rendererName = 'input-file'
  // 继承父类的所有配置能力
}

// 插件 B - 追加额外配置
class PluginB extends BasePlugin {
  rendererName = 'input-file'  // 相同的 rendererName
  
  buildEditorPanel(context, panels) {
    if (context.info.renderer.name === 'input-file') {
      panels.push({  // 向共享数组追加新面板
        key: 'extra-config',
        title: '额外配置',
        render: this.manager.makeSchemaFormRender({
          body: [/* 配置项 */]
        })
      })
    }
  }
}

// 两个插件都注册，配置面板会合并显示
registerEditorPlugin(PluginA)
registerEditorPlugin(PluginB)
```

## 二、配置面板生成方式

### 2.1 声明式（自动生成）

适用于简单场景，框架自动处理面板生成：

```typescript
class MyPlugin extends BasePlugin {
  rendererName = 'my-component'
  
  // 方式 1：使用 panelBodyCreator
  panelBodyCreator = (context) => {
    return [
      getSchemaTpl('fieldSet', {
        title: '基本配置',
        body: [
          { type: 'input-text', name: 'title', label: '标题' }
        ]
      })
    ]
  }
  
  // 方式 2：使用 panelBody（静态配置）
  panelBody = [
    { type: 'input-text', name: 'title', label: '标题' }
  ]
}
```

**框架自动处理**：
- 自动调用 `buildEditorPanel` 方法
- 自动生成配置面板的 key、icon、title
- 自动处理表单提交和数据绑定

### 2.2 命令式（手动控制）

适用于复杂场景，完全控制面板生成逻辑：

```typescript
class MyPlugin extends BasePlugin {
  rendererName = 'my-component'
  
  buildEditorPanel(
    context: BuildPanelEventContext,
    panels: Array<BasicPanelItem>
  ) {
    const store = this.manager.store
    
    // 条件判断：只在特定情况下显示面板
    if (context.info.renderer.name === 'my-component' && !context.selections.length) {
      panels.push({
        key: 'custom-config',           // 面板唯一标识
        icon: 'fa fa-cog',              // 面板图标
        title: '自定义配置',             // 面板标题
        order: 100,                     // 面板排序（可选）
        render: this.manager.makeSchemaFormRender({
          body: [
            getSchemaTpl('fieldSet', {
              title: '高级配置',
              body: [
                { type: 'input-text', name: 'customProp', label: '自定义属性' }
              ]
            })
          ],
          panelById: store.activeId,    // 绑定到当前选中的组件
          submitOnChange: true          // 实时提交（可选）
        })
      })
    }
  }
}
```

## 三、实战案例：扩展 InputFile 组件

### 3.1 需求

为 InputFile 组件添加"提示信息配置"面板，包含：
- `warningText` - 警告文字
- `showSizeHint` - 显示大小提示
- `showTypeHint` - 显示类型提示

### 3.2 扩展示例（当前未实现额外面板）

当前 `frontends/web/ouroboros-amis-runtime/src/editor/plugins/patch/InputFile.ts` 仅注册继承 `FileControlPlugin` 的 `OuroborosFileControlPlugin`。以下第二个插件及提示项是扩展示例，不能作为当前界面已有能力。

```typescript
// frontends/web/ouroboros-amis-runtime/src/editor/plugins/patch/InputFile.ts
import {
  FileControlPlugin,
  registerEditorPlugin,
  BasePlugin,
  getSchemaTpl,
} from 'amis-editor'
import type { BuildPanelEventContext, BasicPanelItem } from 'amis-editor-core'

// 插件 1：保留原有配置能力
export class OuroborosFileControlPlugin extends FileControlPlugin {
  rendererName = 'OuroborosInputFile'
  disabledRendererPlugin = true // 组件面板不显示
}

// 插件 2：追加新的配置面板
export class OuroborosFileControlExtraPlugin extends BasePlugin {
  rendererName = 'OuroborosInputFile'
  
  buildEditorPanel(
    context: BuildPanelEventContext,
    panels: Array<BasicPanelItem>
  ) {
    const store = this.manager.store
    
    // 只在选中当前组件时添加面板
    if (context.info.renderer.name === 'OuroborosInputFile' && !context.selections.length) {
      panels.push({
        key: 'hint-config',
        icon: 'fa fa-info-circle',
        title: '提示信息配置',
        render: this.manager.makeSchemaFormRender({
          body: [
            getSchemaTpl('fieldSet', {
              title: '提示信息配置',
              body: [
                {
                  type: 'input-text',
                  name: 'warningText',
                  label: '警告文字',
                  placeholder: '严禁传输涉密敏感信息',
                  description: '设置为空字符串时不显示',
                },
                getSchemaTpl('switch', {
                  name: 'showSizeHint',
                  label: '显示大小提示',
                  value: true,
                }),
                getSchemaTpl('switch', {
                  name: 'showTypeHint',
                  label: '显示类型提示',
                  value: true,
                }),
              ],
            }),
          ],
          panelById: store.activeId
        })
      })
    }
  }
}

// 注册两个插件
registerEditorPlugin(OuroborosFileControlPlugin)
registerEditorPlugin(OuroborosFileControlExtraPlugin)
```

### 3.3 示例预期效果（需实现并验证）

- ✅ 保留了 FileControlPlugin 的所有原有配置项
- ✅ 新增了独立的"提示信息配置"面板
- ✅ 两个面板可以独立展开/收起
- ✅ 不需要修改原插件代码

## 四、关键 API 说明

### 4.1 BuildPanelEventContext

```typescript
interface BuildPanelEventContext {
  info: {
    renderer: { name: string }  // 当前组件的 rendererName
    plugin: PluginInterface      // 当前组件对应的主插件
    hostId?: string              // 宿主组件 ID（如果有）
  }
  selections: Array<any>         // 多选的组件列表
  data: Array<BasicPanelItem>    // 面板数组
  // ... 其他上下文信息
}
```

### 4.2 BasicPanelItem

```typescript
interface BasicPanelItem {
  key: string                    // 面板唯一标识
  icon?: string                  // 面板图标（FontAwesome）
  pluginIcon?: string            // 插件图标（优先级更高）
  title: string                  // 面板标题
  order?: number                 // 排序权重（数字越小越靠前）
  render: React.ReactNode        // 面板内容渲染
}
```

### 4.3 makeSchemaFormRender

```typescript
this.manager.makeSchemaFormRender({
  body: Array<any>,              // 表单配置项（AMIS Schema）
  panelById: string,             // 绑定的组件 ID
  submitOnChange?: boolean,      // 是否实时提交
  definitions?: any,             // JSON Schema 定义
  api?: any,                     // 提交 API
  justify?: boolean,             // 两端对齐布局
  pipeOut?: Function             // 数据输出管道
})
```

## 五、最佳实践

### 5.1 插件职责分离

```typescript
// ✅ 推荐：职责清晰
class ComponentPlugin extends FileControlPlugin {
  // 继承基础功能；局部面板修正可沿已有 afterBuildPanelBody 扩展
}

class ExtraPanelPlugin extends BasePlugin {
  // 只有确实需要独立贡献面板时才追加另一个插件
}

// ❌ 不推荐：所有功能混在一起
class MonolithPlugin extends FileControlPlugin {
  // 基础功能 + 扩展功能全部写在一起
}
```

### 5.2 条件判断

```typescript
buildEditorPanel(context, panels) {
  // ✅ 推荐：精确匹配
  if (context.info.renderer.name === 'my-component' && !context.selections.length) {
    panels.push(/* ... */)
  }
  
  // ❌ 不推荐：缺少条件判断
  panels.push(/* ... */)  // 会在所有组件上都显示
}
```

### 5.3 面板排序

```typescript
panels.push({
  key: 'basic-config',
  title: '基本配置',
  order: 0,              // 最前面
  // ...
})

panels.push({
  key: 'advanced-config',
  title: '高级配置',
  order: 100,            // 靠后
  // ...
})
```

## 六、核心优势

| 特性 | 说明 |
|------|------|
| **可扩展性** | 多个插件可以为同一组件添加配置，无需修改原代码 |
| **非侵入性** | 通过追加方式扩展，不影响原有功能 |
| **灵活控制** | 可以根据条件动态决定是否显示面板 |
| **职责分离** | 基础功能和扩展功能可以分离到不同插件 |
| **易于维护** | 每个插件独立维护，降低耦合度 |

## 七、常见问题

### Q1: 为什么我的第二个插件没有生效？

**A**: 检查以下几点：
1. 是否正确调用了 `registerEditorPlugin`
2. `rendererName` 是否与目标组件一致
3. `buildEditorPanel` 中的条件判断是否正确
4. 是否在 `context.info.renderer.name` 匹配时才 push

### Q2: 如何控制面板的显示顺序？

**A**: 使用 `order` 属性：
```typescript
panels.push({
  key: 'my-panel',
  order: 50,  // 数字越小越靠前
  // ...
})
```

### Q3: 如何访问父类的配置？

**A**: 继承插件可使用父类能力；不同已注册插件也可以独立贡献面板。沿既有 `afterBuildPanelBody` 或 `buildEditorPanel` 处理局部扩展，是否调用父类方法取决于选用的钩子，不能一概认定没有继承关系。

### Q4: 声明式和命令式如何选择？

**A**: 
- **声明式**：简单场景，只需要添加配置项
- **命令式**：复杂场景，需要条件判断、动态生成、自定义渲染

## 八、当前 main-app 的 Table 分工现状

Web 与 IDE 共用的 Table 实现在 `ouroboros-amis-runtime`，分为两层：

1. **运行时真相在 renderer patch**
   - 路径：`frontends/web/ouroboros-amis-runtime/src/renderers/patch/Table.tsx`
   - 配套样式：`frontends/web/ouroboros-amis-runtime/src/renderers/patch/Table.scss`
   - 职责：统一承载 `OuroborosTable` 的 affixHeader 对齐修复、列配置持久化、表头搜索/筛选/排序、grouped export，以及 `EnhancedColumnToggler` 这套列设置弹层。

2. **编辑器侧处理 rendererName 与编辑器节点识别**
   - 路径：`frontends/web/ouroboros-amis-runtime/src/editor/plugins/patch/Table.ts`
   - 职责：把 AMIS editor 的 `rendererName` 指向 `OuroborosTable`，并通过 `getRendererInfo` 识别普通 Table 及 CRUD 内嵌表格的编辑器节点。
   - 边界：列配置持久化与 grouped export 留在 runtime patch；CRUD 嵌套节点的编辑器识别由 Table plugin 的 `getRendererInfo` 处理。

这个分工的意义是：Table 的行为、样式和持久化只有一条正式真相，editor plugin 只负责把编辑器节点接到这条真相上，不再另起一套平行运行时。

## 九、当前 main-app 的 CRUD 分工现状

Web 与 IDE 共用的 CRUD 实现在 `ouroboros-amis-runtime`，分为两层：

1. **运行时真相在 renderer patch**
   - 路径：`frontends/web/ouroboros-amis-runtime/src/renderers/patch/CRUD.tsx`
   - 配套样式：`frontends/web/ouroboros-amis-runtime/src/renderers/patch/CRUD.scss`
   - 配套布局 helper：`frontends/web/ouroboros-amis-runtime/src/renderers/patch/crudFilterGridLayout.ts`
   - 职责：统一承载 `OuroborosCRUD` 的 headerToolbar/filter 编排，包括 `columns-toggler` 自动注入、相邻 `导出当前页 / 导出全部` `export-excel` 收口、`filter.actions -> button-toolbar` 归一、默认 `搜索 / 重置` 补齐、`handleFilterReset()` 的 query 清理语义，以及 CRUD filter 专用 smartLayout 链路。
   - 结构约束：最终下沉给底层 Form renderer 的 schema 始终显式 `smartLayout: false`；浅底筛选区和 toolbar 对齐则通过 `CRUD.scss` 绑定 `.cxd-Crud-filter--flat`、`.ouroboros-crud-filter-toolbar` 与 `crudFilterGridLayout.ts` 产出的布局类名共同生效。

2. **编辑器侧处理 rendererName 与选中行为的面板缺省值**
   - 路径：`frontends/web/ouroboros-amis-runtime/src/editor/plugins/patch/CRUD.ts`
   - 职责：把 CRUD 节点接到 `rendererName = 'OuroborosCRUD'`，并在 `afterBuildPanelBody` 调整 `checkOnItemClick` 面板的可见性与输入输出缺省值，结合批量动作、pickerMode、selectable 决定是否保留显式值。
   - 边界：editor plugin 不复制 toolbar/filter 归一化、导出收口或筛选区样式语义；这些都只在 runtime patch 主路径里维护。

这个分工的意义是：CRUD 页面对 headerToolbar、filter、样式和布局的解释只有 `OuroborosCRUD` 这一条正式真相，editor plugin 只负责把编辑器节点接入，不再保留原生 CRUD 和本地补丁并行解释的空间。

## 十、当前 main-app 的 Form 分工现状

Web 与 IDE 共用的普通 Form 实现在 `ouroboros-amis-runtime`，分为两层：

1. **运行时真相在 renderer patch**
   - 路径：`frontends/web/ouroboros-amis-runtime/src/renderers/patch/Form.tsx`
   - 配套 helper：`frontends/web/ouroboros-amis-runtime/src/renderers/patch/formSmartLayout.ts`
   - 职责：统一承载 `OuroborosForm` 的 `renderBody()` 主路径，在调用 `FormRendererBase` 前先做普通 Form 的 smartLayout 归一化。
   - 结构约束：根 schema 显式 `smartLayout: true`，或系统配置 `ui.form.smartLayout.enabled=true` 且 schema 未显式关闭时，才进入 `mode + columnCount` 推导；`ui.form.smartLayout.labelStyle` 控制 `mode: 'normal' | 'horizontal'`，`ui.form.smartLayout.smallItemLimit` 与 `ui.form.smartLayout.columnCount.small/large` 控制字段数阈值和列数；显式 `smartLayout: false` / `columnCount` 继续优先；`group` / `flex` / 普通 fieldset 保持旁路；CRUD filter 最终下沉给底层 Form 的 schema 仍由 `OuroborosCRUD` 写死 `smartLayout: false`，不复用普通 Form 的默认语义。

2. **编辑器侧只保留 rendererName + 布局面板注入接缝**
   - 路径：`frontends/web/ouroboros-amis-runtime/src/editor/plugins/patch/Form.ts`
   - 配套 helper：`frontends/web/ouroboros-amis-runtime/src/editor/plugins/patch/formSmartLayoutPanel.ts`
   - 职责：把 AMIS editor 的 Form 节点正式接到 `rendererName = 'OuroborosForm'`，并在普通 Form 场景的“外观 -> 布局”区域注入 `smartLayout` 开关。
   - 边界：开关默认显示为关闭；开启后只写 `smartLayout: true`，关闭时回到未设置；CRUD filter context 继续旁路，不在面板里显示这项控制。

这个分工的意义是：普通 Form 的布局解释只有 `OuroborosForm + formSmartLayout.ts` 这一条正式真相，系统配置只提供 schema 缺省值，editor plugin 只负责把普通 Form 节点接入并暴露默认关闭的开关，不再保留 `dev` 里未接通候选 Form patch 和 `lts-v1` default-on 语义并存的空间。
