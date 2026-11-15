# 样式系统设计理念与原则

> 本文档定义了 Ouroboros Web 低代码平台前端基座的样式系统设计理念、原则和规则，作为构建、重构、扩展和衡量样式系统质量的标准。

---

当前运行时密度为 `compact`、`normal`、`comfortable` 三档，默认 `normal`；注册与变量值以 [density/index.scss](../density/index.scss) 及其转出的三个文件为准。下文 compact/comfortable 代码块仅作两种取值示例。

## 零、文件命名规范 (File Naming Convention)

### 统一命名规则

所有 SCSS 文件使用 **kebab-case** 命名，**不使用下划线前缀**。

**原因：**
- 现代构建工具（Webpack + sass-loader）通过入口文件控制编译，不需要下划线标记 partial 文件
- 简化命名规则，降低心智负担
- 文件用途通过目录结构和文件名即可清晰表达

**示例：**
```
✅ themes/light.scss
✅ tokens/colors.scss
✅ utils/mixins.scss
✅ components/button.scss

❌ themes/_light.scss
❌ tokens/_colors.scss
```

**特殊文件命名：**
- 入口文件：统一命名为 `index.scss`
- 全局文件：`global.scss`, `base.scss`
- 主入口：`src/style/index.scss`

---

## 一、设计理念 (Philosophy)

### 1.1 运行时优先 (Runtime-First)

作为低代码平台前端基座，样式系统必须支持**运行时动态配置**，而非仅依赖构建时编译。

- **CSS Variables 是唯一的对外契约**：所有可配置的样式值必须通过 CSS 自定义属性暴露
- **SCSS 是内部实现细节**：SCSS 的可编程性仅用于减少重复代码，不应成为外部依赖
- **平台可配置性**：主题、密度、品牌色等核心样式参数可通过平台 API 在运行时修改

### 1.2 契约稳定性 (Contract Stability)

对外暴露的 CSS Variables 是与低代码平台、插件、子应用的**稳定 API 契约**。

- **显式声明优于隐式推导**：导出哪些变量必须明确定义，而非自动遍历
- **版本化管理**：变量的增删改需要版本控制和变更日志
- **向后兼容**：废弃变量需要 deprecation 周期，不能直接删除

### 1.3 可理解性 (Comprehensibility)

样式系统的复杂度必须可控，新成员能在合理时间内理解整体架构。

- **单一职责**：每个文件/模块只做一件事
- **扁平优于嵌套**：减少 SCSS 的深层嵌套和间接引用
- **文档即代码**：关键设计决策必须有注释说明

### 1.4 渐进增强 (Progressive Enhancement)

系统应支持从简单到复杂的渐进式使用。

- **最小可用**：仅引入核心变量即可工作
- **按需扩展**：组件级变量、工具类等可选引入
- **降级友好**：CSS Variables 不支持时有合理的 fallback

---

## 二、核心原则 (Principles)

### P1: 三层变量架构

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: 组件变量 (Component Tokens)                        │
│  --button-*, --input-*, --modal-*                           │
│  职责：组件内部样式，引用语义变量                               │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: 语义变量 (Semantic Tokens)                         │
│  --color-text-*, --color-bg-*, --color-border-*             │
│  职责：表达设计意图，主题切换的核心层                           │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: 基础变量 (Primitive Tokens)                        │
│  --space-*, --radius-*, --font-size-*                       │
│  职责：原子级设计令牌，与主题/品牌无关的基础值                   │
└─────────────────────────────────────────────────────────────┘
```

**原则要点**：
- 组件变量只能引用语义变量或基础变量，不能直接写死值
- 语义变量在不同主题下映射到不同的基础变量
- 基础变量是计算的终点，包含实际的 CSS 值

### P1.1: 双维度配置体系

样式系统采用**两个正交维度**进行配置：

```
┌─────────────────────────────────────────────────────────────┐
│  维度 1: 主题 (Theme)                                        │
│  ├── 切换方式：data-theme="light|dark"                       │
│  ├── 控制范围：明暗相关的语义色                                │
│  │   - 背景色明暗 (--color-bg-*)                             │
│  │   - 文本色明暗 (--color-text-*)                           │
│  │   - 边框色明暗 (--color-border-*)                         │
│  │   - 阴影强度                                              │
│  └── 品牌色处理：由 JS 运行时根据模式计算派生值                 │
├─────────────────────────────────────────────────────────────┤
│  维度 2: 密度 (Density)                                      │
│  ├── 切换方式：data-density="compact|normal|comfortable"            │
│  ├── 控制范围：尺寸相关变量（与颜色完全无关）                   │
│  │   - 间距 (--space-*)                                      │
│  │   - 控件高度 (--control-height-*)                         │
│  │   - 字号 (--font-size-*)                                  │
│  └── 圆角 (--radius-*)                                       │
└─────────────────────────────────────────────────────────────┘

品牌色（Brand）不是独立维度，而是**可选的**运行时输入参数：
┌─────────────────────────────────────────────────────────────┐
│  品牌种子 (Brand Seed) - 可选，由平台配置下发                  │
│                                                             │
│  系统提供合理的默认品牌色，用户无需配置即可使用。                │
│  当需要定制时，可配置以下品牌色角色：                           │
│                                                             │
│  ├── primary: #00A1E9     主色（核心品牌识别色）               │
│  ├── secondary: #00D2E9   辅色（次要操作/信息）                │
│  ├── accent: #0057E4      强调色（高亮/引导注意力）             │
│  └── neutral: #666666     中性色（文本/边框基调）              │
│                                                             │
│  → 仅 primary 为必选种子，其他角色可从 primary 自动派生        │
│  → JS 运行时根据种子 + 色彩模式 生成完整色板                   │
│  → 注入 CSS Variables: --color-primary, --color-primary-hover │
└─────────────────────────────────────────────────────────────┘
```

**品牌色角色说明**：

| 角色 | 用途 | 是否必选 | 默认值 |
|-----|------|---------|-------|
| primary | 主要按钮、链接、选中态、核心交互 | 是 | #00A1E9 |
| secondary | 次要按钮、辅助信息、次级导航 | 否 | 由 primary 派生 |
| accent | 徽标、高亮提示、引导用户注意力 | 否 | 由 primary 派生 |
| neutral | 文本、边框、背景的灰度基调 | 否 | #666666 |

> 注：功能色（success/warning/error/info）通常不开放品牌配置，保持语义一致性。

**为什么品牌不是独立维度？**
- 品牌色是**输入种子**，不是切换选项
- 大多数用户使用默认品牌色即可，无需关心配置
- 避免组合爆炸（品牌数 × 模式数 × 密度数）
- 支持多租户动态品牌配置
- 色彩派生逻辑由 JS 运行时完成，而非 SCSS 预编译

### P2: 显式导出清单

所有对外暴露的 CSS Variables 必须在**统一的清单文件**中显式声明。

```scss
// ❌ 错误：自动遍历导出，契约不可控
@each $k, $v in $theme-map {
  --#{$prefix}-#{$k}: #{$v};
}

// ✅ 正确：显式声明导出列表
$exported-space-vars: (xs, sm, md, lg, xl, xxl);
@each $k in $exported-space-vars {
  --space-#{$k}: #{map.get($space-map, $k)};
}
```

### P3: 主题文件只设值

主题文件（如 light.scss, dark.scss）的职责是**设定变量值**，不应包含：
- 复杂的 SCSS 逻辑
- 组件样式定义
- Mixin 调用

```scss
// ❌ 错误：主题文件包含逻辑
[data-theme="dark"] {
  @include generate-palette($dark-primary);
  .button { ... }
}

// ✅ 正确：主题文件只设值
[data-theme="dark"] {
  --color-bg-page: #1a1a1a;
  --color-text: #f0f0f0;
  --color-primary-500: #4a9eff;
}
```

### P4: SCSS 可编程性的边界

SCSS 特性的使用必须有明确边界：

| 允许使用 | 限制使用 | 禁止使用 |
|---------|---------|---------|
| 变量定义 | 深层嵌套 (>3层) | 动态生成选择器名 |
| 简单计算 | 复杂条件逻辑 | 依赖编译顺序的技巧 |
| @use/@forward | @extend | 全局变量污染 |
| 基础 mixin | 递归 mixin | 魔法字符串拼接 |

### P5: 单向数据流

变量的引用关系必须是**单向的**，禁止循环依赖：

```
tokens → semantic → theme → components
   ↓         ↓        ↓         ↓
  基础值   语义映射   主题覆盖   组件应用
```

### P6: 运行时可覆盖

所有通过 CSS Variables 暴露的值，都可以在运行时通过以下方式覆盖：
- JavaScript 动态设置 `document.documentElement.style.setProperty()`
- 平台配置下发的内联样式
- 用户自定义主题 CSS

---

## 三、具体规则 (Rules)

### R1: 文件组织规则

```
src/style/
├── tokens/                 # 基础令牌（SCSS 变量，构建时）
│   ├── index.scss        # 统一导出
│   ├── base.scss         # 基础单位（space-unit, radius-base 等）
│   ├── spacing.scss      # 间距比例
│   └── typography.scss   # 字体比例
│
├── contract/              # 🆕 CSS Variables 契约（对外 API）
│   ├── index.scss        # 契约入口
│   ├── primitives.scss   # 基础变量清单（space, radius, font-size）
│   ├── semantic.scss     # 语义变量清单（color-text, color-bg）
│   └── components.scss   # 组件变量清单（button, input）
│
├── themes/                 # 🆕 色彩模式
│   ├── light.scss        # 浅色模式的语义色值
│   ├── dark.scss         # 深色模式的语义色值
│   └── index.scss        # 模式注册
│
├── density/               # 🆕 密度配置
│   ├── compact.scss      # 紧凑密度的尺寸值
│   ├── comfortable.scss  # 舒适密度的尺寸值
│   └── index.scss        # 密度注册
│
├── utils/                 # SCSS 工具（内部使用）
│   ├── functions.scss    # 纯函数
│   └── mixins.scss       # 混合器
│
├── components/            # 组件样式
├── layout/               # 布局样式
└── index.scss            # 主入口
```

**注意**：品牌色不在 SCSS 中定义，由 JS 运行时注入。

### R2: 变量命名规则

```scss
// ============================================
// 内部色板（不对外暴露，仅供主题文件引用）
// ============================================
// 命名：--palette-{hue}-{scale}
// 这是实现细节，平台用户无需关心
$palette-blue-500: #00A1E9;
$palette-blue-600: #0091d4;

// ============================================
// 基础变量（对外 API）
// ============================================
// 命名：--{category}-{scale}
// 用于尺寸、间距等与颜色无关的令牌
--space-sm: 8px;
--radius-md: 4px;
--font-size-lg: 16px;
--control-height-md: 32px;

// ============================================
// 语义变量（对外 API - 核心）
// ============================================
// 命名：--color-{purpose}-{variant?}
// ⚠️ 禁止在语义变量名中使用色阶数字（如 -500、-600）
// 语义变量表达的是"用途"而非"色值"

// ✅ 正确：用途明确
--color-primary: #00A1E9;
--color-primary-hover: #0091d4;
--color-primary-active: #0081be;
--color-primary-bg: #e6f7ff;
--color-primary-text: #006bb3;

// ❌ 错误：暴露实现细节
--color-primary-500: #00A1E9;
--color-primary-600: #0091d4;

// 其他语义变量示例
--color-text: #1f1f1f;
--color-text-secondary: #666666;
--color-bg-page: #ffffff;
--color-border: #e0e0e0;
--color-border-hover: #d0d0d0;

// ============================================
// 组件变量（对外 API）
// ============================================
// 命名：--{component}-{property}-{state?}
--button-bg: var(--color-primary);
--button-bg-hover: var(--color-primary-hover);
--input-border-focus: var(--color-border-focus);
```

变量命名必须以自然语义为中心，而不是以产品、项目或组织名作为命名空间。

- ✅ 使用组件、表面、用途和状态表达含义：`--table-placeholder-color`、`--crud-filter-gap`、`--toast-status-bg`
- ❌ 禁止使用产品名或缩写前缀：`--ouroboros-*`、`--ob-*`
- 内部适配层变量也遵守同一规则；即使变量不对外承诺稳定性，也应使用自然语义命名，避免把基座实现和项目品牌绑定

**为什么语义变量不应包含色阶数字？**

1. **用户友好**：平台用户只需配置 `--color-primary`，无需理解 500 是什么
2. **解耦实现**：hover 状态用 `-hover` 而非 `-600`，更换色板算法时无需改 API
3. **运行时简化**：覆盖少量语义变量即可完成主题定制

### R3: 配置维度切换规则

```scss
// ============================================
// 维度 1: 主题（明暗切换）
// ============================================
[data-theme="light"] {
  --color-bg-page: #ffffff;
  --color-text: #1f1f1f;
  --color-border: #e0e0e0;
  // 品牌派生色由 JS 注入
}

[data-theme="dark"] {
  --color-bg-page: #1a1a1a;
  --color-text: #f0f0f0;
  --color-border: #3a3a3a;
  // 品牌派生色由 JS 注入
}

// ============================================
// 维度 2: 密度（尺寸切换）
// ============================================
[data-density="compact"] {
  --space-xs: 2px;
  --space-sm: 4px;
  --space-md: 8px;
  --control-height-sm: 24px;
  --control-height-md: 28px;
  --control-height-lg: 32px;
}

[data-density="comfortable"] {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --control-height-sm: 28px;
  --control-height-md: 36px;
  --control-height-lg: 44px;
}

// ============================================
// 品牌色：由 JS 运行时注入（非 CSS 切换）
// ============================================
// 平台配置下发品牌种子后，JS 计算并注入：
// :root {
//   --color-primary: #00A1E9;
//   --color-primary-hover: #0091d4;
//   --color-primary-active: #0081be;
//   --color-primary-bg: #e6f7ff;
//   ...
// }
```

**运行时配置 API 示例**：
```typescript
interface BrandConfig {
  primary: string;      // 必选：主色种子
  secondary?: string;   // 可选：辅色种子（默认从 primary 派生）
  accent?: string;      // 可选：强调色种子（默认从 primary 派生）
  neutral?: string;     // 可选：中性色种子（默认 #666666）
}

interface ThemeConfig {
  theme: 'light' | 'dark';
  density: 'compact' | 'normal' | 'comfortable';
  brand?: BrandConfig;  // 可选：不传则使用系统默认品牌色
}

function applyTheme(config: ThemeConfig) {
  const root = document.documentElement;
  
  // 设置主题
  root.dataset.theme = config.theme;
  
  // 设置密度
  root.dataset.density = config.density;
  
  // 计算并注入品牌色（如果提供）
  if (config.brand) {
    const palette = generatePalette(config.brand, config.theme);
    Object.entries(palette).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
  }
}

// 使用示例
applyTheme({ theme: 'light', density: 'comfortable' }); // 使用默认品牌色
applyTheme({ 
  theme: 'dark', 
  density: 'compact',
  brand: { primary: '#ff6b00' }  // 仅自定义主色，其他自动派生
});
```

### R4: 导出契约规则

```scss
// contract/primitives.scss
// 这是对外 API，修改需要版本控制

// v1.0.0 - 基础间距（密度层控制）
$contract-space: (xs, sm, md, lg, xl, xxl, xxxl);

// v1.0.0 - 基础圆角（密度层控制）
$contract-radius: (sm, md, lg, xl, pill);

// v1.0.0 - 基础字号（密度层控制）
$contract-font-size: (xs, sm, md, lg, xl, xxl, xxxl);

// v1.0.0 - 控件高度（密度层控制）
$contract-control: (height-sm, height-md, height-lg);

// contract/semantic.scss
// v1.0.0 - 语义色（模式层控制 + 品牌注入）
$contract-color-semantic: (
  // 品牌色（JS 运行时注入）
  primary, primary-hover, primary-active, primary-bg, primary-text,
  // 功能色（模式层定义）
  success, success-bg, warning, warning-bg, error, error-bg, info, info-bg,
  // 中性色（模式层定义）
  text, text-secondary, text-tertiary, text-disabled,
  bg-page, bg-body, bg-elevated, bg-disabled,
  border, border-hover, border-strong
);
```

### R5: 组件样式规则

```scss
// 组件样式必须使用 CSS Variables（语义变量）
.button {
  height: var(--button-height, var(--control-height-md));
  padding: 0 var(--button-padding-x, var(--space-md));
  background: var(--button-bg, var(--color-primary));
  border-radius: var(--button-radius, var(--radius-md));
  
  &:hover {
    background: var(--button-bg-hover, var(--color-primary-hover));
  }
}
```

### R6: 禁止事项

1. **禁止**在组件样式中直接使用 SCSS 变量（必须通过 CSS Variables）
2. **禁止**在主题文件中定义组件样式
3. **禁止**使用 `@extend`（会产生不可预测的选择器）
4. **禁止**超过 3 层的选择器嵌套
5. **禁止**在 runtime 目录外调用 `export-*` mixin
6. **禁止**未经声明就导出新的 CSS Variable
7. **禁止**在对外语义变量名中使用色阶数字（如 `--color-primary-500`）

---

## 四、当前问题诊断

基于以上原则，当前样式系统存在以下问题：

### 问题 1: 契约不清晰
- `css-var.scss` 中的 `export-theme-to-root` 自动遍历 map 导出变量
- 无法明确知道对外暴露了哪些 CSS Variables
- 新增 theme key 会自动扩展 API，违反契约稳定性

### 问题 2: 配置维度混乱
- `data-theme` 同时控制明暗模式和品牌色，职责不清
- `theme/default.scss` 和 `themes/light.scss` 功能重叠
- 品牌色在 SCSS 中预编译，无法运行时动态配置

### 问题 3: SCSS 过度使用
- `functions/color.scss` 的 `scale()` 函数在构建时生成色板
- 色板无法在运行时修改，违反运行时优先原则
- 深层 map 嵌套增加理解成本

### 问题 4: 重复定义
- `$map-tokens` 在 `theme/default.scss` 和 `themes/semantic.scss` 中重复
- 控件高度在多处定义
- 色板生成逻辑重复

---

## 五、重构方向

### 阶段 1: 建立契约层
1. 创建 `contract/` 目录，显式声明所有对外 CSS Variables
2. 将 `export-*` mixin 改为基于契约清单导出
3. 生成 `css-variables.d.ts` 类型定义供 TypeScript 使用

### 阶段 2: 重构配置维度
1. 创建 `density/` 目录，独立管理尺寸相关变量
2. 移除 SCSS 中的品牌色定义，改为 JS 运行时注入
3. 删除 `theme/` 目录（与 `themes/` 重复）

### 阶段 3: 实现运行时品牌色
1. 创建 `src/utils/theme.ts`，实现 `generatePalette()` 函数
2. 实现 `applyTheme()` API，统一管理主题/密度/品牌配置
3. 品牌色派生算法从 SCSS `functions/color.scss` 迁移到 JS

### 阶段 4: 清理遗留代码
1. 移除 `runtime/themes.scss` 和 `runtime/density.scss`
2. 简化 `functions/css-var.scss`，移除自动遍历逻辑
3. 扁平化 token map 结构，减少嵌套

---

## 六、质量检查清单

在提交样式相关代码前，检查以下项目：

- [ ] 新增的 CSS Variable 是否在契约清单中声明？
- [ ] CSS Variable 是否使用自然语义命名，且没有产品名/项目名/缩写前缀？
- [ ] 组件样式是否只使用 CSS Variables（语义变量）？
- [ ] 主题文件是否只包含明暗相关的语义色？
- [ ] 密度文件是否只包含尺寸相关变量？
- [ ] 品牌色是否通过 JS 运行时注入而非 SCSS 预编译？
- [ ] SCSS 嵌套是否超过 3 层？
- [ ] 是否有循环依赖？
- [ ] 是否有重复定义？
- [ ] 语义变量名是否避免了色阶数字？

---

*文档版本: 1.1.0*
*最后更新: 2026-01-13*
*变更: 采用双维度配置体系（主题 + 密度），品牌色改为运行时注入*
