# 前端样式表与布局系统完整架构设计

当前运行时密度为 `compact`、`normal`、`comfortable` 三档，默认 `normal`；注册与变量值以 [density/index.scss](../density/index.scss) 及其转出的三个文件为准。下文 compact/comfortable 代码块仅作两种取值示例。

## 目录

1. [样式表系统架构](#1-样式表系统架构)
   - 1.1 [目录结构架构](#11-目录结构架构)
   - 1.2 [变量系统架构](#12-变量系统架构)
   - 1.3 [配置维度架构](#13-配置维度架构)
   - 1.4 [响应式系统架构](#14-响应式系统架构)
   - 1.5 [组件分层架构](#15-组件分层架构)
   - 1.6 [工具类系统架构](#16-工具类系统架构)
   - 1.7 [文件导入顺序架构](#17-文件导入顺序架构)

2. [布局系统架构](#2-布局系统架构)
   - 2.1 [基础区域命名规范](#21-基础区域命名规范)
   - 2.2 [应用挂载点设计](#22-应用挂载点设计)
   - 2.3 [三种布局模式定义](#23-三种布局模式定义)
   - 2.4 [DOM结构方案](#24-dom结构方案)
   - 2.5 [完整DOM架构](#25-完整dom架构)
   - 2.6 [标签栏功能设计](#26-标签栏功能设计)

3. [集成实现方案](#3-集成实现方案)
4. [最佳实践指南](#4-最佳实践指南)
5. [性能优化建议](#5-性能优化建议)

---

## 1. 样式表系统架构

> 📖 详细的设计理念与原则请参阅 [style-system-principles.md](./style-system-principles.md)

### 1.1 目录结构架构

```
styles/
├── index.scss                    # 🚀 主入口文件
│
├── tokens/                       # 🎨 设计令牌（SCSS 变量，构建时）
│   ├── index.scss              # 令牌导出入口
│   ├── base.scss               # 基础单位（space-unit, radius-base）
│   ├── spacing.scss            # 间距比例
│   └── typography.scss         # 字体比例
│
├── contract/                     # 📋 CSS Variables 契约（对外 API）
│   ├── index.scss              # 契约入口
│   ├── primitives.scss         # 基础变量清单（space, radius, font-size）
│   ├── semantic.scss           # 语义变量清单（color-text, color-bg）
│   └── components.scss         # 组件变量清单（button, input）
│
├── themes/                        # 🌓 色彩模式（明暗切换）
│   ├── index.scss              # 模式注册
│   ├── light.scss              # 浅色模式语义色
│   └── dark.scss               # 深色模式语义色
│
├── density/                      # 📐 密度配置（尺寸切换）
│   ├── index.scss              # 密度注册
│   ├── compact.scss            # 紧凑密度
│   └── comfortable.scss        # 舒适密度
│
├── base/                         # 📋 基础样式层
│   ├── index.scss              # 基础样式入口
│   ├── reset.scss              # CSS 重置
│   └── typography.scss         # 基础字体样式
│
├── layout/                       # 📐 布局系统
│   ├── index.scss              # 布局导出入口
│   ├── variables.scss          # 布局变量
│   ├── container.scss          # 容器系统
│   ├── header.scss             # 头部布局
│   ├── sidebar.scss            # 侧边栏布局
│   ├── _main-content.scss       # 主内容区
│   ├── tabs.scss               # 标签栏布局
│   ├── footer.scss             # 底部布局
│   ├── layouts/                 # 布局模式
│   │   ├── _sidebar-split.scss  # 左导航分区布局
│   │   ├── _header-sidebar.scss # T型布局
│   │   └── _header-only.scss    # 顶部导航布局
│   └── responsive/              # 响应式布局
│       ├── mobile.scss
│       ├── tablet.scss
│       └── desktop.scss
│
├── components/                   # 🧩 组件样式系统
│   ├── index.scss
│   ├── atoms/                   # 原子组件（button, input, checkbox...）
│   ├── molecules/               # 分子组件（form-group, search-box...）
│   └── organisms/               # 有机体组件（navigation, data-table...）
│
├── utilities/                    # 🔧 工具类系统
│   ├── index.scss
│   ├── spacing.scss            # 间距工具类
│   ├── typography.scss         # 文本工具类
│   ├── _colors.scss             # 颜色工具类
│   ├── _display.scss            # 显示工具类
│   └── _flexbox.scss            # Flex 工具类
│
├── animations/                   # 🎭 动画系统
│   ├── index.scss
│   ├── _keyframes.scss          # 关键帧定义
│   ├── _transitions.scss        # 过渡动画
│   └── _micro-interactions.scss # 微交互动画
│
├── utils/                        # 🔧 SCSS 工具（内部使用）
│   ├── functions.scss          # 纯函数
│   └── mixins.scss             # 混合器
│
├── vendor/                       # 📦 第三方库覆盖
│   └── index.scss
│
└── pages/                        # 📄 页面特定样式
    └── index.scss
```

**与旧架构的关键变化**：

| 变化 | 说明 |
|-----|------|
| 新增 `contract/` | 显式声明对外 CSS Variables 契约 |
| 新增 `density/` | 密度作为独立配置维度 |
| 移除 `tokens/colors.scss` | 品牌色由 JS 运行时注入，不在 SCSS 预定义 |
| `functions/` + `mixins/` → `utils/` | 合并为内部工具目录 |

### 1.2 变量系统架构

#### 1.2.1 三层变量架构

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: 组件变量 (Component Tokens)                        │
│  --button-*, --input-*, --modal-*                           │
│  职责：组件内部样式，引用语义变量                               │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: 语义变量 (Semantic Tokens)                         │
│  --color-text-*, --color-bg-*, --color-border-*             │
│  职责：表达设计意图，模式切换的核心层                           │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: 基础变量 (Primitive Tokens)                        │
│  --space-*, --radius-*, --font-size-*, --control-height-*   │
│  职责：原子级设计令牌，与模式/品牌无关的基础值                   │
└─────────────────────────────────────────────────────────────┘
```

#### 1.2.2 基础变量（Layer 1）

```scss
// tokens/base.scss - SCSS 变量（构建时）
$space-unit: 4px;
$font-size-base: 14px;
$radius-base: 2px;

// contract/primitives.scss - CSS Variables（运行时）
:root {
  /* 间距系统 */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-xxl: 32px;
  
  /* 圆角系统 */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 8px;
  --radius-pill: 999px;
  
  /* 字号系统 */
  --font-size-xs: 12px;
  --font-size-sm: 13px;
  --font-size-md: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 18px;
  
  /* 控件高度 */
  --control-height-sm: 24px;
  --control-height-md: 32px;
  --control-height-lg: 40px;
}
```

#### 1.2.3 语义变量（Layer 2）

```scss
// contract/semantic.scss
// ⚠️ 语义变量禁止使用色阶数字（如 -500、-600）

:root {
  /* 文本颜色 - 表达用途而非色值 */
  --color-text: #1f1f1f;
  --color-text-secondary: #666666;
  --color-text-tertiary: #999999;
  --color-text-disabled: #aaaaaa;
  
  /* 背景颜色 */
  --color-bg-page: #ffffff;
  --color-bg-elevated: #fafafa;
  --color-bg-disabled: #f5f5f5;
  
  /* 边框颜色 */
  --color-border: #e0e0e0;
  --color-border-hover: #d0d0d0;
  --color-border-strong: #c0c0c0;
  
  /* 品牌色（由 JS 运行时注入，此处为默认值） */
  --color-primary: #00A1E9;
  --color-primary-hover: #0091d4;
  --color-primary-active: #0081be;
  --color-primary-bg: #e6f7ff;
  
  /* 功能色 */
  --color-success: #52c41a;
  --color-warning: #faad14;
  --color-error: #ff4d4f;
  --color-info: #00A1E9;
}
```

#### 1.2.4 组件变量（Layer 3）

```scss
// contract/components.scss
:root {
  /* 按钮组件 */
  --button-height: var(--control-height-md);
  --button-padding-x: var(--space-md);
  --button-radius: var(--radius-md);
  --button-bg: var(--color-primary);
  --button-bg-hover: var(--color-primary-hover);
  
  /* 输入框组件 */
  --input-height: var(--control-height-md);
  --input-padding-x: var(--space-sm);
  --input-border: var(--color-border);
  --input-border-focus: var(--color-primary);
}
```

### 1.3 配置维度架构

样式系统采用**两个正交维度**进行配置，品牌色作为可选的运行时参数。

#### 1.3.1 双维度配置体系

```
┌─────────────────────────────────────────────────────────────┐
│  维度 1: 色彩模式 (Color Mode)                               │
│  ├── 切换方式：data-theme="light|dark"                        │
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
```

#### 1.3.2 色彩模式切换

```scss
// themes/light.scss
[data-theme="light"] {
  --color-bg-page: #ffffff;
  --color-bg-elevated: #fafafa;
  --color-text: #1f1f1f;
  --color-text-secondary: #666666;
  --color-border: #e0e0e0;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.06);
}

// themes/dark.scss
[data-theme="dark"] {
  --color-bg-page: #1a1a1a;
  --color-bg-elevated: #2a2a2a;
  --color-text: #f0f0f0;
  --color-text-secondary: #aaaaaa;
  --color-border: #3a3a3a;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
}
```

#### 1.3.3 密度切换

```scss
// density/compact.scss
[data-density="compact"] {
  --space-xs: 2px;
  --space-sm: 4px;
  --space-md: 8px;
  --space-lg: 12px;
  --control-height-sm: 24px;
  --control-height-md: 28px;
  --control-height-lg: 32px;
  --font-size-md: 13px;
}

// density/comfortable.scss
[data-density="comfortable"] {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --control-height-sm: 28px;
  --control-height-md: 36px;
  --control-height-lg: 44px;
  --font-size-md: 14px;
}
```

#### 1.3.4 品牌色运行时注入

品牌色**不是独立维度**，而是可选的运行时输入参数。系统提供默认品牌色，用户无需配置即可使用。

**品牌色角色**：

| 角色 | 用途 | 是否必选 | 默认值 |
|-----|------|---------|-------|
| primary | 主要按钮、链接、选中态 | 是 | #00A1E9 |
| secondary | 次要按钮、辅助信息 | 否 | 由 primary 派生 |
| accent | 徽标、高亮、引导 | 否 | 由 primary 派生 |
| neutral | 文本、边框基调 | 否 | #666666 |

**运行时配置 API**：

```typescript
interface BrandConfig {
  primary: string;      // 必选：主色种子
  secondary?: string;   // 可选：辅色（默认派生）
  accent?: string;      // 可选：强调色（默认派生）
  neutral?: string;     // 可选：中性色（默认 #666666）
}

interface ThemeConfig {
  mode: 'light' | 'dark';
  density: 'compact' | 'normal' | 'comfortable';
  brand?: BrandConfig;  // 可选：不传则使用默认品牌色
}

function applyTheme(config: ThemeConfig) {
  const root = document.documentElement;
  
  // 设置模式
  root.dataset.mode = config.mode;
  
  // 设置密度
  root.dataset.density = config.density;
  
  // 计算并注入品牌色（如果提供）
  if (config.brand) {
    const palette = generatePalette(config.brand, config.mode);
    Object.entries(palette).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
  }
}

// 使用示例
applyTheme({ mode: 'light', density: 'comfortable' }); // 默认品牌色
applyTheme({ 
  mode: 'dark', 
  density: 'compact',
  brand: { primary: '#ff6b00' }  // 自定义主色
});
```

### 1.4 响应式系统架构

#### 1.4.1 断点系统

```scss
// tokens/breakpoints.scss
:root {
  --breakpoint-xs: 480px;
  --breakpoint-sm: 768px;
  --breakpoint-md: 1024px;
  --breakpoint-lg: 1280px;
  --breakpoint-xl: 1920px;
}

// mixins/breakpoints.scss
@mixin mobile-only {
  @media (max-width: calc(var(--breakpoint-sm) - 1px)) {
    @content;
  }
}

@mixin tablet-up {
  @media (min-width: var(--breakpoint-sm)) {
    @content;
  }
}

@mixin desktop-up {
  @media (min-width: var(--breakpoint-md)) {
    @content;
  }
}
```

#### 1.4.2 响应式策略

```scss
// 1. 组件内响应式 - 推荐
.btn {
  padding: var(--btn-padding-md);
  
  @include mobile-only {
    padding: var(--btn-padding-sm);
  }
}

// 2. 响应式工具类
.hide-mobile {
  @include mobile-only {
    display: none !important;
  }
}

.show-desktop {
  @include tablet-down {
    display: none !important;
  }
}
```

### 1.5 组件分层架构

#### 1.5.1 原子设计系统

```scss
// 原子组件 - 最小单位
.btn { /* 按钮 */ }
.input { /* 输入框 */ }

// 分子组件 - 功能组合
.search-box { /* 搜索框 = 输入框 + 按钮 */ }
.form-group { /* 表单组 = 标签 + 输入框 + 帮助文本 */ }

// 有机体组件 - 复杂功能块
.data-table { /* 数据表格 */ }
.navigation { /* 导航菜单 */ }

// 模板组件 - 页面级布局
.page-header { /* 页面头部模板 */ }
.dashboard-layout { /* 仪表板布局 */ }
```

#### 1.5.2 组件命名规范

```scss
/* 块级组件 */
.component-name { }

/* 元素修饰 */
.component-name__element { }

/* 状态修饰 */
.component-name--modifier { }
.component-name--size-large { }
.component-name--variant-primary { }

/* 示例：按钮组件 */
.btn { }                    /* 基础按钮 */
.btn__icon { }             /* 按钮图标 */
.btn--primary { }          /* 主要按钮 */
.btn--size-large { }       /* 大尺寸按钮 */
.btn--loading { }          /* 加载状态 */
```

### 1.6 工具类系统架构

#### 1.6.1 工具类命名规范

```scss
/* 间距工具类 */
.m-0 { margin: 0; }                    /* margin: 0 */
.mt-4 { margin-top: var(--space-4); }  /* margin-top: 16px */
.p-md { padding: var(--space-md); }    /* padding: 16px */

/* 文本工具类 */
.text-sm { font-size: var(--text-sm); }
.text-center { text-align: center; }
.text-primary { color: var(--color-primary); }

/* 显示工具类 */
.d-flex { display: flex; }
.d-none { display: none; }
.justify-center { justify-content: center; }

/* 响应式工具类 */
.d-md-block {
  @include desktop-up {
    display: block !important;
  }
}
```

### 1.7 文件导入顺序架构

#### 1.7.1 主入口文件 (index.scss)

```scss
// ===== 1. SCSS 工具层（内部使用，不产生 CSS 输出）=====
@use 'utils/functions';
@use 'utils/mixins';

// ===== 2. 设计令牌层（SCSS 变量）=====
@use 'tokens';

// ===== 3. CSS Variables 契约（对外 API）=====
@use 'contract';

// ===== 4. 配置维度 =====
@use 'themes';      // 色彩模式（light/dark）
@use 'density';    // 密度（compact/normal/comfortable）

// ===== 5. 基础样式层 =====
@use 'base';

// ===== 6. 布局系统 =====
@use 'layout';

// ===== 7. 组件系统 =====
@use 'components';

// ===== 8. 工具类系统 =====
@use 'utilities';

// ===== 9. 动画系统 =====
@use 'animations';

// ===== 10. 第三方覆盖（最后导入，优先级最高）=====
@use 'vendor';

// ===== 11. 页面特定样式 =====
@use 'pages';
```

#### 1.7.2 各模块入口文件示例

```scss
// contract/index.scss - CSS Variables 契约
@use 'primitives';   // 基础变量
@use 'semantic';     // 语义变量
@use 'components';   // 组件变量

// themes/index.scss - 色彩模式
@use 'light';
@use 'dark';

// density/index.scss - 密度配置
@use 'compact';
@use 'normal';
@use 'comfortable';

// components/index.scss - 组件样式
@use 'atoms';
@use 'molecules';
@use 'organisms';
```

---

## 2. 布局系统架构

### 2.1 基础区域命名规范

#### 2.1.1 核心区域定义

- **顶部区域**：Header（`.app-header`）
- **侧边栏区域**：Sidebar（`.app-sidebar` / `.navigation`）
- **主内容区域**：Main Content（`.app-content` / `.content-main`）
- **推荐使用class选择器而非id选择器**，以提供更好的样式优先级控制

#### 2.1.2 语义化命名体系

```scss
// 应用级容器
.app-container { }           // 应用根容器
.app-header { }             // 应用头部
.app-body { }               // 应用主体
.app-sidebar { }            // 应用侧边栏
.app-content { }            // 应用内容区

// 内容区细分
.content-header { }         // 内容头部（面包屑+工具栏）
.content-tabs { }           // 内容标签栏
.content-main { }           // 内容主体
.content-footer { }         // 内容底部
```

### 2.2 应用挂载点设计

#### 2.2.1 框架特定挂载点

```html
<!-- React项目挂载点 -->
<div id="root"></div>

<!-- Vue项目挂载点 -->
<div id="app"></div>

<!-- Angular项目挂载点 -->
<app-root></app-root>
```

#### 2.2.2 挂载点样式基础

```scss
// 挂载点基础样式
#root, #app, app-root {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  
  // 确保应用占满视口
  display: flex;
  flex-direction: column;
}
```

### 2.3 三种布局模式定义

#### 2.3.1 Sidebar-Split Layout（侧边分区布局）

```scss
.layout-sidebar-split {
  .app-header {
    display: none; // 隐藏顶部头部
  }
  
  .app-body {
    display: flex;
    height: 100vh;
    
    .app-sidebar {
      width: var(--sidebar-width, 240px);
      background: var(--color-bg-sidebar);
      border-right: 1px solid var(--color-border);
    }
    
    .app-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
  }
}
```

- **特点**：左导航，右侧区域上下分区
- **适用场景**：传统后台管理系统
- **布局结构**：侧边栏 + 内容区（含头部工具栏）

#### 2.3.2 Header-Sidebar Layout（T型布局）

```scss
.layout-header-sidebar {
  .app-header {
    height: var(--header-height, 60px);
    background: var(--color-bg-header);
    border-bottom: 1px solid var(--color-border);
  }
  
  .app-body {
    display: flex;
    height: calc(100vh - var(--header-height, 60px));
    
    .app-sidebar {
      width: var(--sidebar-width, 240px);
      background: var(--color-bg-sidebar);
      border-right: 1px solid var(--color-border);
    }
    
    .app-content {
      flex: 1;
      overflow: hidden;
    }
  }
}
```

- **特点**：顶部头部 + 左侧导航的T型结构
- **适用场景**：需要全局信息展示的应用
- **布局结构**：头部 + (侧边栏 + 内容区)

#### 2.3.3 Header-Only Layout（顶部导航布局）

```scss
.layout-header-only {
  .app-header {
    height: var(--header-height, 60px);
    background: var(--color-bg-header);
    border-bottom: 1px solid var(--color-border);
  }
  
  .app-body {
    height: calc(100vh - var(--header-height, 60px));
    
    .app-sidebar {
      display: none; // 隐藏侧边栏
    }
    
    .app-content {
      height: 100%;
      overflow: hidden;
    }
  }
}
```

- **特点**：仅顶部导航，无侧边栏
- **适用场景**：简洁的应用界面或移动端适配
- **布局结构**：头部 + 内容区

### 2.4 DOM结构方案

#### 2.4.1 推荐方案：共用DOM结构

**优势分析：**
- **性能优化**：避免DOM重新渲染，减少重排重绘
- **状态保持**：组件状态在布局切换时得以保留
- **代码简洁**：通过CSS类名控制显示，逻辑清晰
- **维护性强**：单一DOM结构，样式统一管理

#### 2.4.2 布局切换实现

```javascript
// 布局切换逻辑示例
const switchLayout = (layoutMode) => {
  const app = document.getElementById('app');
  
  // 移除现有布局类
  app.classList.remove('layout-sidebar-split', 'layout-header-sidebar', 'layout-header-only');
  
  // 添加新布局类
  app.classList.add(`layout-${layoutMode}`);
  
  // 触发布局计算更新
  window.dispatchEvent(new Event('resize'));
};
```

### 2.5 完整DOM架构

#### 2.5.1 标准DOM结构

```html
<div id="app" class="layout-${layoutMode}">
  <!-- 应用头部：包含logo、全局导航、用户信息等 -->
  <header class="app-header">
    <div class="header-left">
      <div class="logo">应用Logo</div>
      <nav class="header-nav">顶部导航</nav>
    </div>
    <div class="header-right">
      <div class="header-actions">用户操作区</div>
    </div>
  </header>
  
  <!-- 应用主体 -->
  <div class="app-body">
    <!-- 侧边栏：包含主导航菜单 -->
    <aside class="app-sidebar">
      <nav class="sidebar-nav">
        <div class="nav-section">
          <h3 class="nav-title">功能模块</h3>
          <ul class="nav-menu">
            <li class="nav-item">
              <a href="#" class="nav-link">菜单项1</a>
            </li>
            <li class="nav-item active">
              <a href="#" class="nav-link">菜单项2</a>
            </li>
          </ul>
        </div>
      </nav>
    </aside>
    
    <!-- 内容区域 -->
    <div class="app-content">
      <!-- 内容头部：面包屑、页面标题、操作按钮 -->
      <div class="content-header">
        <div class="breadcrumb">
          <span class="breadcrumb-item">首页</span>
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-item">用户管理</span>
        </div>
        <div class="page-actions">
          <button class="btn btn--primary">新建用户</button>
        </div>
      </div>
      
      <!-- 标签栏：内部页面切换 -->
      <div class="content-tabs">
        <div class="tabs-nav">
          <div class="tab-item active">用户列表</div>
          <div class="tab-item">角色管理</div>
          <div class="tab-item closeable">
            权限设置
            <span class="tab-close">×</span>
          </div>
        </div>
        <div class="tabs-actions">
          <button class="tab-action">全部关闭</button>
        </div>
      </div>
      
      <!-- 主内容区：页面实际内容 -->
      <main class="content-main">
        <div class="page-content">
          <!-- 具体页面内容 -->
        </div>
      </main>
    </div>
  </div>
</div>
```

#### 2.5.2 DOM结构样式框架

```scss
// 应用根容器
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// 应用头部
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-lg);
  background: var(--color-bg-header);
  border-bottom: 1px solid var(--color-border);
  z-index: var(--z-header);
}

// 应用主体
.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

// 侧边栏
.app-sidebar {
  background: var(--color-bg-sidebar);
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  z-index: var(--z-sidebar);
}

// 内容区域
.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// 内容头部
.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  background: var(--color-bg-content-header);
  border-bottom: 1px solid var(--color-border-light);
}

// 标签栏
.content-tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-bg-tabs);
  border-bottom: 1px solid var(--color-border-light);
}

// 主内容区
.content-main {
  flex: 1;
  overflow: auto;
  background: var(--color-bg-main);
}
```

### 2.6 标签栏功能设计

#### 2.6.1 标签栏核心功能

- **标签管理**：新增、关闭、拖拽排序
- **状态保持**：切换标签时保持页面状态
- **右键菜单**：关闭其他、关闭左侧、关闭右侧、全部关闭
- **滚动支持**：标签过多时支持左右滚动
- **持久化存储**：浏览器刷新后恢复标签状态

#### 2.6.2 标签栏样式实现

```scss
// 标签栏容器
.content-tabs {
  display: flex;
  align-items: center;
  height: var(--tabs-height, 40px);
  background: var(--color-bg-tabs);
  border-bottom: 1px solid var(--color-border-light);
  
  .tabs-nav {
    flex: 1;
    display: flex;
    align-items: center;
    overflow-x: auto;
    scrollbar-width: none; // Firefox
    
    &::-webkit-scrollbar {
      display: none; // Chrome/Safari
    }
    
    .tab-item {
      display: flex;
      align-items: center;
      padding: 0 var(--space-md);
      height: 100%;
      background: var(--color-bg-tab);
      border-right: 1px solid var(--color-border-light);
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
      transition: background-color var(--duration-fast);
      
      &:hover {
        background: var(--color-bg-tab-hover);
      }
      
      &.active {
        background: var(--color-bg-tab-active);
        color: var(--color-primary);
        
        &::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--color-primary);
        }
      }
      
      &.closeable {
        padding-right: var(--space-sm);
        
        .tab-close {
          margin-left: var(--space-xs);
          padding: 2px;
          border-radius: 50%;
          cursor: pointer;
          
          &:hover {
            background: var(--color-bg-close-hover);
          }
        }
      }
    }
  }
  
  .tabs-actions {
    display: flex;
    align-items: center;
    padding: 0 var(--space-md);
    
    .tab-action {
      padding: var(--space-xs) var(--space-sm);
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-text-secondary);
      
      &:hover {
        color: var(--color-text-primary);
      }
    }
  }
}
```

#### 2.6.3 标签栏交互逻辑

```javascript
// 标签栏管理类示例
class TabsManager {
  constructor(container) {
    this.container = container;
    this.tabs = [];
    this.activeTab = null;
    this.init();
  }
  
  // 初始化
  init() {
    this.bindEvents();
    this.restoreTabs();
  }
  
  // 添加标签
  addTab(tab) {
    const existingTab = this.tabs.find(t => t.id === tab.id);
    if (existingTab) {
      this.activateTab(existingTab.id);
      return;
    }
    
    this.tabs.push(tab);
    this.renderTabs();
    this.activateTab(tab.id);
    this.saveTabs();
  }
  
  // 关闭标签
  closeTab(tabId) {
    const tabIndex = this.tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;
    
    this.tabs.splice(tabIndex, 1);
    
    // 如果关闭的是当前激活标签，激活相邻标签
    if (this.activeTab === tabId && this.tabs.length > 0) {
      const newActiveIndex = Math.min(tabIndex, this.tabs.length - 1);
      this.activateTab(this.tabs[newActiveIndex].id);
    }
    
    this.renderTabs();
    this.saveTabs();
  }
  
  // 激活标签
  activateTab(tabId) {
    this.activeTab = tabId;
    this.renderTabs();
    this.emitTabChange(tabId);
  }
}
```

---

## 3. 集成实现方案

### 3.1 样式表与布局的集成点

#### 3.1.1 布局变量集成

```scss
// layout/variables.scss - 布局专用变量
:root {
  /* 布局尺寸 */
  --header-height: 60px;
  --sidebar-width: 240px;
  --sidebar-collapsed-width: 60px;
  --tabs-height: 40px;
  --footer-height: 60px;
  
  /* 布局断点 */
  --layout-mobile-breakpoint: var(--breakpoint-sm);
  --layout-tablet-breakpoint: var(--breakpoint-md);
  
  /* 布局Z-index */
  --z-header: 1000;
  --z-sidebar: 900;
  --z-tabs: 800;
  --z-content: 100;
  --z-modal: 2000;
  
  /* 布局颜色 */
  --color-bg-header: var(--color-bg-primary);
  --color-bg-sidebar: var(--color-bg-secondary);
  --color-bg-content-header: var(--color-bg-primary);
  --color-bg-tabs: var(--color-bg-tertiary);
  --color-bg-main: var(--color-bg-primary);
}
```

#### 3.1.2 响应式布局集成

```scss
// layout/responsive-integration.scss
.app-container {
  // 移动端适配
  @include mobile-only {
    .app-header {
      height: var(--header-height-mobile, 50px);
    }
    
    .app-sidebar {
      position: fixed;
      left: -100%;
      width: 80vw;
      height: 100vh;
      z-index: var(--z-sidebar-mobile, 1500);
      transition: left var(--duration-normal);
      
      &.is-open {
        left: 0;
      }
    }
    
    .content-tabs {
      overflow-x: auto;
      scrollbar-width: none;
    }
  }
  
  // 平板端适配
  @include tablet-only {
    .app-sidebar {
      width: var(--sidebar-width-tablet, 200px);
    }
  }
}
```

### 3.2 配置维度与布局联动

#### 3.2.1 色彩模式下的布局调整

```scss
// 深色模式下的布局调整
[data-theme="dark"] {
  --color-bg-header: #1a1a1a;
  --color-bg-sidebar: #141414;
  --color-bg-tabs: #1a1a1a;
  --color-border: #3a3a3a;
  
  .app-sidebar {
    .nav-link {
      color: #aaaaaa;
      
      &:hover, &.active {
        color: #ffffff;
        background: #2a2a2a;
      }
    }
  }
}
```

#### 3.2.2 密度与布局联动

```scss
// 紧凑密度下的布局调整
[data-density="compact"] {
  --header-height: 48px;
  --sidebar-width: 200px;
  --tabs-height: 32px;
  
  .app-sidebar .nav-link {
    padding: var(--space-xs) var(--space-sm);
  }
}

// 舒适密度下的布局调整
[data-density="comfortable"] {
  --header-height: 60px;
  --sidebar-width: 240px;
  --tabs-height: 40px;
  
  .app-sidebar .nav-link {
    padding: var(--space-sm) var(--space-md);
  }
}
```

### 3.3 组件与布局的协调

#### 3.3.1 布局感知组件

```scss
// 组件根据布局模式调整样式
.data-table {
  // 基础样式
  width: 100%;
  
  // 在侧边栏布局中的调整
  .layout-sidebar-split &,
  .layout-header-sidebar & {
    max-width: calc(100vw - var(--sidebar-width) - var(--space-xl));
  }
  
  // 在仅头部布局中的调整
  .layout-header-only & {
    max-width: calc(100vw - var(--space-xl));
  }
}
```

---

## 4. 最佳实践指南

### 4.1 命名约定统一

#### 4.1.1 统一命名规范

```scss
/* CSS 变量命名 */

// 基础变量：--{category}-{scale}
--space-md                  /* 间距-中等 */
--radius-lg                 /* 圆角-大 */
--font-size-sm              /* 字号-小 */

// 语义变量：--color-{purpose}-{variant?}
// ⚠️ 禁止使用色阶数字（如 -500、-600）
--color-primary             /* ✅ 正确 */
--color-primary-hover       /* ✅ 正确 */
--color-primary-500         /* ❌ 错误 */
--color-text                /* 文本色 */
--color-bg-page             /* 页面背景 */

// 组件变量：--{component}-{property}-{state?}
--button-bg                 /* 按钮背景 */
--button-bg-hover           /* 按钮悬停背景 */
--input-border-focus        /* 输入框聚焦边框 */

/* 组件类名：BEM 命名法 */
.layout-header             /* 布局头部 */
.layout-header__logo       /* 布局头部的 logo 元素 */
.layout-header--collapsed  /* 布局头部的折叠状态 */

/* 工具类命名：简洁语义化 */
.d-flex                    /* display: flex */
.text-center               /* text-align: center */
.mb-md                     /* margin-bottom: var(--space-md) */
```

#### 4.1.2 语义化优先原则

```scss
// ✅ 推荐：语义化命名
.sidebar-navigation { }
.content-main { }
--color-text-secondary

// ❌ 避免：过度缩写或暴露实现
.sb-nav { }
.ct-mn { }
--gray-600
```

### 4.2 模块化组织

#### 4.2.1 功能模块划分

```scss
// 每个功能独立管理
@import 'layout/header';      // 头部布局
@import 'layout/sidebar';     // 侧边栏布局
@import 'layout/content';     // 内容区布局
@import 'layout/responsive';  // 响应式布局
```

#### 4.2.2 依赖关系管理

```scss
// 明确的依赖层级
// 1. 基础层（无依赖）
@import 'tokens';
@import 'base';

// 2. 工具层（依赖基础层）
@import 'functions';
@import 'mixins';

// 3. 组件层（依赖工具层）
@import 'layout';
@import 'components';
```

### 4.3 可维护性策略

#### 4.3.1 版本化管理

```scss
/**
 * 样式表版本: v2.1.0
 * 更新时间: 2024-01-15
 * 重大变更:
 * - 新增深色主题支持
 * - 重构布局系统变量
 * - 优化响应式断点
 */
```

#### 4.3.2 文档化注释

```scss
/**
 * 按钮组件样式
 * 
 * @example
 * <button class="btn btn--primary btn--size-lg">
 *   点击按钮
 * </button>
 * 
 * @modifiers
 * --primary: 主要按钮样式
 * --secondary: 次要按钮样式
 * --size-sm: 小尺寸按钮
 * --size-lg: 大尺寸按钮
 */
.btn {
  /* 按钮基础样式 */
}
```

### 4.4 测试与验证

#### 4.4.1 跨浏览器测试

```scss
// 浏览器兼容性处理
.layout-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  
  // IE11降级处理
  @supports not (display: grid) {
    display: flex;
    flex-wrap: wrap;
    
    > * {
      flex: 0 0 calc(100% / 12);
    }
  }
}
```

#### 4.4.2 模式切换测试

```scss
// 色彩模式测试用例
@each $theme in (light, dark) {
  [data-theme="#{$theme}"] {
    .btn--primary {
      // 验证对比度符合无障碍标准
    }
  }
}

// 密度测试用例
@each $density in (compact, normal, comfortable) {
  [data-density="#{$density}"] {
    .btn {
      height: var(--control-height-md);
    }
  }
}
```

---

## 5. 性能优化建议

### 5.1 CSS性能优化

#### 5.1.1 选择器优化

```scss
/* 优秀的选择器性能 */
.btn-primary { }
.nav-link { }
.content-main { }

/* 避免的低效选择器 */
div.container .sidebar ul li a.active { }  // 过深嵌套
* { }                                      // 通配符选择器
.btn[data-state="active"][data-size="lg"] { } // 多属性选择器
```

#### 5.1.2 CSS自定义属性优化

```scss
// 预计算复杂值
.component {
  --component-computed-size: calc(
    var(--base-size) * var(--scale-factor) + var(--offset)
  );
  
  width: var(--component-computed-size);
  height: var(--component-computed-size);
}

// 避免在动画中重复计算
@keyframes slideIn {
  from {
    transform: translateX(var(--slide-distance));
  }
  to {
    transform: translateX(0);
  }
}
```

#### 5.1.3 关键渲染路径优化

```scss
// 关键样式内联
.above-fold-content {
  /* 首屏关键样式 */
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

// 非关键样式延迟加载
.below-fold-component {
  /* 通过动态导入加载 */
}
```

### 5.2 布局性能优化

#### 5.2.1 减少重排重绘

```scss
// 使用transform和opacity进行动画
.sidebar-animate {
  transform: translateX(-100%);
  transition: transform var(--duration-normal);
  
  &.is-open {
    transform: translateX(0);
  }
}

// 使用CSS containment
.layout-section {
  contain: layout style paint;
}

// 避免影响布局的属性动画
.tooltip {
  // 好的做法
  opacity: 0;
  transform: scale(0.8);
  transition: opacity var(--duration-fast), 
              transform var(--duration-fast);
  
  // 避免的做法
  // height: 0;
  // width: 0;
}
```

#### 5.2.2 虚拟滚动支持

```scss
// 为虚拟滚动提供样式支持
.virtual-scroll-container {
  height: 400px;
  overflow: auto;
  contain: strict;
}

.virtual-scroll-item {
  contain: layout style paint;
  will-change: transform;
}
```

### 5.3 资源加载优化

#### 5.3.1 CSS拆分策略

```scss
// 核心样式（同步加载）
@import 'critical';      // 首屏关键样式

// 功能样式（异步加载）
@import 'components';    // 组件样式
@import 'pages';         // 页面特定样式
@import 'utilities';     // 工具类样式
```

#### 5.3.2 媒体查询优化

```scss
// 合并相同断点的媒体查询
@media (min-width: 768px) {
  .header { height: 60px; }
  .sidebar { width: 240px; }
  .content { padding: 24px; }
}

// 避免重复的媒体查询
@media (min-width: 768px) {
  .header { height: 60px; }
}
@media (min-width: 768px) {
  .sidebar { width: 240px; }
}
```

---

## 结语

本架构设计提供了完整的前端样式表与布局系统解决方案，核心特点：

**运行时优先**：CSS Variables 作为对外契约，支持平台动态配置主题、密度和品牌色。

**双维度配置**：色彩模式（light/dark）与密度（compact/normal/comfortable）正交独立，品牌色作为可选运行时参数。

**契约稳定性**：通过 `contract/` 目录显式声明对外 API，变量增删需版本控制。

**语义化命名**：禁止在对外变量中使用色阶数字，用 `--color-primary-hover` 而非 `--color-primary-600`。

详细的设计理念与原则请参阅 [style-system-principles.md](./style-system-principles.md)。