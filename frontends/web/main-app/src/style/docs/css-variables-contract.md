# CSS Variables 契约清单

> 本文维护 Tier 1/2 的 CSS Variables 契约，并列出适配层与内部变量供定位。正式声明在 `ouroboros-amis-runtime/src/style/contract/*.scss`：primitives 以 mixin 导出，semantic/components 以 Sass 清单声明名称；具体值由 theme、density 与适配样式定义。名称在清单中不保证目标主题已提供缺省值，使用前需检查最终样式与 fallback。

## 版本

v1.0.0

---

## Tier 1: 核心契约（Core Contract）

> 必须稳定，修改需版本控制

### 基础变量 (Primitives)

#### 间距 (Space)
- `--space-xs`
- `--space-sm`
- `--space-md`
- `--space-lg`
- `--space-xl`
- `--space-xxl`
- `--space-xxxl`
- `--space`

#### 圆角 (Radius)
- `--radius-sm`
- `--radius-md`
- `--radius-lg`
- `--radius-xl`
- `--radius-pill`
- `--radius`

#### 字号 (Font Size)
- `--font-size-xs`
- `--font-size-sm`
- `--font-size-md`
- `--font-size-lg`
- `--font-size-xl`
- `--font-size-xxl`
- `--font-size-xxxl`
- `--font-size`

#### 控件高度 (Control Height)
- `--control-height-sm`
- `--control-height-md`
- `--control-height-lg`
- `--control-height`

#### 行高 (Line Height)
- `--line-height-tight`
- `--line-height-normal`
- `--line-height-relaxed`

#### 字重 (Font Weight)
- `--font-weight-regular`
- `--font-weight-medium`
- `--font-weight-semibold`
- `--font-weight-bold`

#### Z-Index
- `--z-index-base`
- `--z-index-dropdown`
- `--z-index-fixed`
- `--z-index-modal`
- `--z-index-popover`
- `--z-index-notification`

#### 动效 (Motion)
- `--motion-duration-fast`
- `--motion-duration-normal`
- `--motion-duration-medium`
- `--motion-duration-slow`
- `--motion-easing-standard`
- `--motion-easing-decelerate`
- `--motion-easing-accelerate`

#### 阴影 (Shadow)
- `--shadow-sm`
- `--shadow-md`
- `--shadow-lg`

#### 断点 (Breakpoint)
- `--breakpoint-xs`
- `--breakpoint-sm`
- `--breakpoint-md`
- `--breakpoint-lg`

### 语义色 (Semantic Colors)

#### 品牌色
- `--color-primary`
- `--color-primary-hover`
- `--color-primary-active`
- `--color-primary-bg`
- `--color-primary-bg-hover`
- `--color-primary-border`
- `--color-primary-text`

#### 功能色 - Success
- `--color-success`
- `--color-success-bg`
- `--color-success-bg-hover`
- `--color-success-border`
- `--color-success-text`

#### 功能色 - Warning
- `--color-warning`
- `--color-warning-bg`
- `--color-warning-bg-hover`
- `--color-warning-border`
- `--color-warning-text`

#### 功能色 - Error
- `--color-error`
- `--color-error-bg`
- `--color-error-bg-hover`
- `--color-error-border`
- `--color-error-text`

#### 功能色 - Info
- `--color-info`
- `--color-info-bg`
- `--color-info-bg-hover`
- `--color-info-border`
- `--color-info-text`

#### 文本色
- `--color-text`
- `--color-text-primary`
- `--color-text-secondary`
- `--color-text-tertiary`
- `--color-text-quaternary`
- `--color-text-placeholder`
- `--color-text-disabled`

#### 背景色
- `--color-bg-page`
- `--color-bg-body`
- `--color-bg-layout`
- `--color-bg-disabled`
- `--color-bg-hover`
- `--color-bg-selected`
- `--color-bg-elevated`
- `--color-bg-container`
- `--color-bg-inverse`
- `--color-bg-sidebar`
- `--color-bg-spotlight`
- `--color-bg-mask`

#### 边框色
- `--color-border`
- `--color-border-primary`
- `--color-border-secondary`
- `--color-border-tertiary`
- `--color-border-hover`
- `--color-border-strong`
- `--color-border-stronger`
- `--color-border-disabled`
- `--color-border-focus`

#### 链接色
- `--color-link`
- `--color-link-hover`
- `--color-link-active`

#### 填充色
- `--color-fill`
- `--color-fill-primary`
- `--color-fill-secondary`
- `--color-fill-tertiary`
- `--color-fill-quaternary`

#### 其他
- `--color-outline`
- `--color-shadow`
- `--color-shadow-strong`
- `--color-danger`

## Tier 2: 组件契约（Component Contract）

> 相对稳定，组件重构时可能变化

### 按钮 (Button)
- `--button-height`, `--button-height-sm`, `--button-height-md`, `--button-height-lg`
- `--button-padding-x`, `--button-padding-x-sm`, `--button-padding-x-lg`, `--button-padding-y`
- `--button-font-size`, `--button-font-size-sm`, `--button-font-size-lg`, `--button-font-weight`
- `--button-border-radius`, `--button-border-radius-sm`, `--button-border-radius-lg`
- `--button-border-width`, `--button-border-style`
- `--button-radius`, `--button-shadow`, `--button-shadow-active`, `--button-hover-shadow`
- `--button-loading-overlay`
- `--button-primary-bg`, `--button-primary-bg-hover`, `--button-primary-bg-active`, `--button-primary-bg-disabled`
- `--button-primary-text`, `--button-primary-text-disabled`
- `--button-primary-border`, `--button-primary-border-hover`, `--button-primary-border-active`, `--button-primary-border-disabled`
- `--button-default-bg`, `--button-default-bg-hover`, `--button-default-bg-active`, `--button-default-bg-disabled`, `--button-default-bg-color`
- `--button-default-text`, `--button-default-text-hover`, `--button-default-text-active`, `--button-default-text-disabled`
- `--button-default-border`, `--button-default-border-hover`, `--button-default-border-active`, `--button-default-border-disabled`, `--button-default-border-color`
- `--button-success-bg`, `--button-success-bg-hover`, `--button-success-bg-active`, `--button-success-text`, `--button-success-border`
- `--button-warning-bg`, `--button-warning-bg-hover`, `--button-warning-bg-active`, `--button-warning-text`, `--button-warning-border`
- `--button-error-bg`, `--button-error-bg-hover`, `--button-error-bg-active`, `--button-error-text`, `--button-error-border`
- `--button-info-bg`, `--button-info-bg-hover`, `--button-info-bg-active`, `--button-info-text`, `--button-info-border`

### 输入框 (Input)
- `--input-bg`, `--input-bg-disabled`
- `--input-text`, `--input-text-disabled`, `--input-placeholder`, `--input-placeholder-color`, `--input-color`
- `--input-border`, `--input-border-color`, `--input-border-hover`, `--input-border-focus`, `--input-border-disabled`, `--input-border-error`
- `--input-border-width`, `--input-border-radius`
- `--input-outline`, `--input-outline-error`
- `--input-height`, `--input-padding-x`, `--input-font-size`, `--input-font-weight`
- `--input-clear-color`, `--input-clear-color-hover`
- `--input-hover-border-color`, `--input-focus-border-color`, `--input-focus-shadow`
- `--input-disabled-bg`, `--input-disabled-border-color`, `--input-disabled-color`
- `--input-error-bg`, `--input-error-border-color`

### 标签页 (Tabs)
- `--tabs-text`, `--tabs-text-active`
- `--tabs-line`, `--tabs-line-active`
- `--tabs-bg`, `--tabs-bg-hover`, `--tabs-bg-selected`
- `--tabs-border-color`, `--tabs-border-focus`
- `--tabs-color`, `--tabs-hover-color`, `--tabs-active-color`, `--tabs-active-border-color`
- `--tabs-bg`, `--tabs-height`, `--tabs-font-size`
- `--tabs-item-height`, `--tabs-item-bg`, `--tabs-item-bg-hover`, `--tabs-item-bg-active`
- `--tabs-item-text`, `--tabs-item-text-active`
- `--tabs-item-border`
- `--tabs-menu-bg`, `--tabs-menu-text`, `--tabs-menu-text-disabled`
- `--tabs-menu-border`, `--tabs-menu-shadow`
- `--tabs-menu-item-bg-hover`, `--tabs-menu-item-text-hover`
- `--tabs-padding-x`, `--tabs-padding-t`

### 标签栏 (Tabbar)
- `--tabbar-bg`, `--tabbar-height`
- `--tabbar-item-height`, `--tabbar-item-bg`, `--tabbar-item-bg-hover`, `--tabbar-item-bg-active`
- `--tabbar-item-text`, `--tabbar-item-text-active`, `--tabbar-item-border`
- `--tabbar-padding-x`, `--tabbar-padding-t`

### 菜单 (Menu)
- `--menu-bg`, `--menu-border`, `--menu-text`, `--menu-text-secondary`
- `--menu-item-text-active`, `--menu-item-bg-hover`, `--menu-item-bg-active`, `--menu-item-bg-selected`
- `--menu-icon`, `--menu-icon-secondary`

### 弹窗 (Modal)
- `--modal-mask-bg`, `--modal-bg`, `--modal-text`
- `--modal-header-bg`, `--modal-header-text`, `--modal-header-color`
- `--modal-body-color`
- `--modal-border`, `--modal-border-radius`, `--modal-shadow`

### 提示 (Toast)
- `--toast-shadow`

### 表格 (Table)
- `--table-header-bg`, `--table-header-text`, `--table-header-color`, `--table-header-border-color`
- `--table-row-bg`, `--table-row-bg-hover`, `--table-row-bg-selected`, `--table-row-text`, `--table-row-hover-bg`
- `--table-border`, `--table-border-color`, `--table-border-focus`
- `--table-font-size`, `--table-selected-row-bg`

### 选择器 (Select)
- `--select-bg`, `--select-bg-hover`, `--select-bg-active`, `--select-bg-disabled`
- `--select-text`, `--select-text-disabled`, `--select-placeholder`
- `--select-border`, `--select-border-color`, `--select-border-hover`, `--select-border-focus`, `--select-border-error`, `--select-border-radius`
- `--select-outline`
- `--select-arrow`, `--select-height`, `--select-padding-x`, `--select-font-size`, `--select-color`
- `--select-hover-border-color`, `--select-focus-border-color`
- `--select-disabled-bg`, `--select-disabled-border-color`, `--select-disabled-color`
- `--select-dropdown-bg`
- `--select-option-color`, `--select-option-hover-bg`, `--select-option-selected-bg`, `--select-option-selected-color`

### 下拉菜单 (Dropdown)
- `--dropdown-menu-bg`, `--dropdown-menu-border`, `--dropdown-menu-shadow`
- `--dropdown-item-text`, `--dropdown-item-text-selected`, `--dropdown-item-text-disabled`
- `--dropdown-item-bg-hover`, `--dropdown-item-bg-active`, `--dropdown-item-bg-selected`, `--dropdown-item-selected`
- `--dropdown-divider`

### 复选框 (Checkbox)
- `--checkbox-bg`, `--checkbox-bg-hover`, `--checkbox-bg-disabled`
- `--checkbox-border`, `--checkbox-border-color`, `--checkbox-border-hover`, `--checkbox-border-disabled`, `--checkbox-border-radius`
- `--checkbox-checked-bg`, `--checkbox-checked-border`, `--checkbox-checked-border-color`
- `--checkbox-checkmark-color`, `--checkbox-outline`, `--checkbox-size`
- `--checkbox-hover-border-color`
- `--checkbox-disabled-bg`, `--checkbox-disabled-border-color`, `--checkbox-disabled-color`

### 单选框 (Radio)
- `--radio-bg`, `--radio-bg-hover`, `--radio-bg-disabled`
- `--radio-border`, `--radio-border-color`, `--radio-border-hover`, `--radio-border-disabled`
- `--radio-checked-bg`, `--radio-checked-border`
- `--radio-dot`, `--radio-dot-color`, `--radio-outline`, `--radio-size`
- `--radio-hover-border-color`
- `--radio-disabled-bg`, `--radio-disabled-border-color`, `--radio-disabled-color`

### 开关 (Switch)
- `--switch-track-bg`, `--switch-track-bg-hover`, `--switch-track-bg-checked`, `--switch-track-bg-disabled`
- `--switch-track-border`, `--switch-track-border-checked`
- `--switch-thumb-bg`, `--switch-thumb-shadow`
- `--switch-outline`, `--switch-height`, `--switch-width`
- `--switch-bg`, `--switch-checked-bg`, `--switch-disabled-bg`, `--switch-handle-bg`, `--switch-handle-size`

### 侧边栏 (Sidebar)
- `--sidebar-width`, `--sidebar-width-open`, `--sidebar-width-tablet`, `--sidebar-secondary-width`
- `--sidebar-bg`, `--sidebar-search-bg`
- `--sidebar-float-item-bg-hover`, `--sidebar-float-item-text`, `--sidebar-float-item-text-active`
- `--sidebar-float-border`, `--sidebar-float-menu-title-bg`, `--sidebar-float-menu-item-bg`, `--sidebar-float-menu-bg`
- `--sidebar-nav-item-bg-active`, `--sidebar-nav-item-text-active`
- `--sidebar-menu-bg`, `--sidebar-menu-border`, `--sidebar-menu-text`, `--sidebar-menu-text-secondary`
- `--sidebar-menu-item-text-active`, `--sidebar-menu-item-bg-hover`, `--sidebar-menu-item-bg-active`
- `--sidebar-menu-icon-secondary`

### 顶栏 (Topbar)
- `--topbar-height`, `--topbar-bg`, `--topbar-color`, `--topbar-margin`

### 布局 (Layout)
- `--layout-header-height`, `--layout-footer-height`, `--layout-content-bg`
- `--layout-breakpoint-sm`, `--layout-breakpoint-md`, `--layout-breakpoint-lg`
- `--layout-container-max-width`, `--layout-container-padding-x`
- `--layout-sidebar-width`, `--layout-sidebar-width-open`
- `--layout-nav-item-bg-active`, `--layout-nav-item-text-active`

### 组件通用 (Component)
- `--component-page-padding-x`, `--component-page-padding-y`
- `--component-header-height`, `--component-tab-height`, `--component-card-padding`

### 过渡动画 (Transition)
- `--transition-fast`, `--transition-normal`, `--transition-slow`
- `--transition-duration-fast`, `--transition-duration-normal`, `--transition-duration-slow`
- `--transition-easing-standard`, `--transition-easing-decelerate`, `--transition-easing-accelerate`
- `--transition-color`, `--transition-opacity`, `--transition-shadow`, `--transition-transform`

### 表单 (Form)
- `--form-label-color`, `--form-label-font-size`, `--form-label-font-weight`, `--form-label-margin-bottom`, `--form-label-padding-right`
- `--form-error-color`, `--form-error-font-size`, `--form-error-line-height`, `--form-error-padding-top`
- `--form-item-margin-bottom`
- `--form-required-color`, `--form-required-margin-right`

### 分页 (Pagination)
- `--pagination-bg`, `--pagination-hover-bg`, `--pagination-active-bg`, `--pagination-disabled-bg`
- `--pagination-active-color`, `--pagination-disabled-color`, `--pagination-border-color`
- `--pagination-font-size`, `--pagination-height`

### Widget
- `--widget-header-height`, `--widget-footer-height`

---

## Tier 3: 适配层（Adaptation Layer）

> 第三方库覆盖，不保证稳定性，不进行规范化检查

### vendor/amis 相关变量

以下变量来自 amis 库，命名不符合本系统规范，但为保持兼容性不做修改：

- `--active`
- `--full`
- `--group`
- `--left`
- `--level-0`
- `--multi`
- `--primary`
- `--right`
- `--secondary`
- `--single`
- `--user-menu`
- `--vertical`
- `--Checkbox-color`
- `--Form-input-borderWidth`
- `--Form-input-onFocused-borderColor`
- `--Form-input-onHover-borderColor`
- `--Form-select-menu-bg`
- `--Form-select-menu-color`
- `--Tabs--line-active-color`
- `--Tabs--line-border-color`
- `--Tabs--line-border-style`
- `--Tabs--line-border-width`
- `--button-primary-default-bg-color`, `--button-primary-default-bg-hover`, `--button-primary-default-bg-active`, `--button-primary-default-bg-disabled`
- `--button-primary-default-text`, `--button-primary-default-text-hover`, `--button-primary-default-text-active`, `--button-primary-default-text-disabled`
- `--button-primary-default-border-color`, `--button-primary-default-border-hover`, `--button-primary-default-border-active`, `--button-primary-default-border-disabled`
- `--input-default-disabled-bg-color`
- `--input-default-disabled-top-border-color`, `--input-default-disabled-top-border-style`, `--input-default-disabled-top-border-width`
- `--input-default-disabled-right-border-color`, `--input-default-disabled-right-border-style`, `--input-default-disabled-right-border-width`
- `--input-default-disabled-bottom-border-color`, `--input-default-disabled-bottom-border-style`, `--input-default-disabled-bottom-border-width`
- `--input-default-disabled-left-border-color`, `--input-default-disabled-left-border-style`, `--input-default-disabled-left-border-width`
- `--input-default-disabled-top-left-border-radius`, `--input-default-disabled-top-right-border-radius`
- `--input-default-disabled-bottom-left-border-radius`, `--input-default-disabled-bottom-right-border-radius`
- `--input-default-disabled-paddingTop`, `--input-default-disabled-paddingRight`, `--input-default-disabled-paddingBottom`, `--input-default-disabled-paddingLeft`

---

## 内部变量（不对外承诺稳定性）

以下变量用于 `main-app` 壳层、布局和局部交互实现，不属于 public contract；若后续需要对外承诺稳定性，应先进入 `ouroboros-amis-runtime/src/style/contract/*.scss`。

### 密度运行时系数

- `--density-space`, `--density-control`, `--density-font`

### 密度 Scale 基准值

以下变量用于密度系统内部计算，不对外承诺稳定性：

- `--scale-space-xs`, `--scale-space-sm`, `--scale-space-md`, `--scale-space-lg`, `--scale-space-xl`, `--scale-space-xxl`, `--scale-space-xxxl`
- `--scale-font-size-xs`, `--scale-font-size-sm`, `--scale-font-size-md`, `--scale-font-size-lg`, `--scale-font-size-xl`, `--scale-font-size-xxl`, `--scale-font-size-xxxl`
- `--scale-control-height-sm`, `--scale-control-height-md`, `--scale-control-height-lg`
- `--scale-radius-sm`, `--scale-radius-md`, `--scale-radius-lg`, `--scale-radius-xl`, `--scale-radius-pill`

### Tabs 交互实现

- `--app-tabs-drag-offset`, `--app-tabs-drag-transform-duration`
- `--app-tabs-track-line-overhang`, `--app-tabs-track-line-left-overhang`, `--app-tabs-track-line-right-overhang`
- `--app-tabs-edge-shadow-start`, `--app-tabs-edge-shadow-mid`, `--app-tabs-edge-shadow-end`
- `--app-tabs-control-icon-color`
- `--tabs-item-text-hover`
- `--tabs-item-border-hover`, `--tabs-item-border-active`, `--tabs-item-border-active-bottom`
- `--tabs-item-radius-tl`, `--tabs-item-radius-tr`, `--tabs-item-radius-br`, `--tabs-item-radius-bl`

### Icon 局部实现

- `--built-in-icon-size`

### Menu 壳层实现

- `--menu-padding`
- `--menu-item-height`, `--menu-item-padding-left`, `--menu-item-radius`, `--menu-item-gap`
- `--menu-item-bg-ancestor`, `--menu-item-text-ancestor`
- `--menu-icon-size`, `--menu-icon-hover`, `--menu-icon-active`, `--menu-icon-ancestor`
- `--menu-arrow-color`, `--menu-arrow-size`, `--menu-arrow-offset-inline`
- `--menu-float-title-bg`
- `--menu-submenu-bg`, `--menu-submenu-padding`, `--menu-submenu-icon-size`
- `--menu-content-gap`, `--menu-submenu-content-gap`, `--menu-indent-step`, `--menu-parent-padding-inline-end`
- `--menu-submenu-item-height`, `--menu-submenu-item-padding-left`, `--menu-submenu-item-margin`, `--menu-submenu-item-radius`
- `--menu-collapsed-item-radius`

### Sidebar 壳层与 user menu 实现

- `--layout-sidebar-secondary-width`, `--layout-shell-gap`, `--layout-shell-radius`
- `--layout-shell-bg`, `--layout-shell-surface`, `--layout-shell-border`, `--layout-shell-shadow`
- `--sidebar-border`, `--sidebar-text`, `--sidebar-text-secondary`, `--sidebar-item-bg-hover`
- `--sidebar-content-inset-x`, `--sidebar-content-inset-y`, `--sidebar-scrollbar-gutter`
- `--sidebar-search-text`, `--sidebar-search-placeholder`, `--sidebar-search-icon`, `--sidebar-search-meta-text`, `--sidebar-search-empty-text`, `--sidebar-search-focus-shadow`, `--sidebar-toggle-text-hover`
- `--sidebar-user-menu-text`, `--sidebar-user-menu-text-secondary`
- `--sidebar-user-menu-avatar`, `--sidebar-user-menu-avatar-hover`, `--sidebar-user-menu-avatar-bg`, `--sidebar-user-menu-avatar-border`, `--sidebar-user-menu-avatar-text`
- `--sidebar-user-menu-arrow`, `--sidebar-user-menu-arrow-hover`
- `--sidebar-user-menu-bg-hover`, `--sidebar-user-menu-bg-open`, `--sidebar-user-menu-shadow-open`, `--sidebar-user-menu-item-bg-hover`, `--sidebar-user-menu-item-text`, `--sidebar-user-menu-text-hover`
- `--sidebar-gradient-top`, `--sidebar-gradient-mid`, `--sidebar-gradient-bottom`
- `--user-menu-avatar-bg`, `--user-menu-avatar-border`, `--user-menu-avatar-text`
- `--user-menu-item-bg-hover`, `--user-menu-item-text`
- `--user-menu-trigger-bg-open`, `--user-menu-trigger-shadow-open`

### Header user menu 实现

- `--header-user-menu-text`, `--header-user-menu-text-secondary`
- `--header-user-menu-avatar`, `--header-user-menu-avatar-hover`, `--header-user-menu-avatar-bg`, `--header-user-menu-avatar-border`, `--header-user-menu-avatar-text`
- `--header-user-menu-arrow`, `--header-user-menu-arrow-hover`
- `--header-user-menu-bg-hover`, `--header-user-menu-bg-open`, `--header-user-menu-shadow-open`, `--header-user-menu-item-bg-hover`, `--header-user-menu-item-text`

### Search overlay 实现

- `--search-input-bg`, `--search-input-focus-shadow`, `--search-results-bg`, `--search-results-border`, `--search-results-shadow`
- `--search-item-text`, `--search-item-bg-hover`
- `--search-divider`
- `--search-control-height`, `--search-collapsed-size`
- `--search-panel-padding`, `--search-panel-radius`
- `--search-icon-size`, `--search-icon-offset-inline`, `--search-icon-gap`
- `--search-input-padding-inline-start`, `--search-input-padding-inline-end`
- `--search-active-icon-offset-block`
- `--search-floating-left`, `--search-floating-top`, `--search-floating-width`, `--search-floating-viewport-gap`
- `--search-empty-illustration-size`

### Scrollbar 壳层实现

- `--scrollbar-track-size`, `--scrollbar-rail-offset-inline-end`, `--scrollbar-rail-offset-block-end`
- `--scrollbar-rail-inset-block`, `--scrollbar-rail-inset-inline`
- `--scrollbar-thumb-radius`, `--scrollbar-thumb-bg`, `--scrollbar-thumb-bg-hover`, `--scrollbar-thumb-bg-active`
- `--scrollbar-rail-bg`, `--scrollbar-transition`
- `--c-scrollbar-track-size`, `--c-scrollbar-rail-offset-inline-end`, `--c-scrollbar-rail-offset-block-end`
- `--c-scrollbar-rail-inset-block`, `--c-scrollbar-rail-inset-inline`
- `--c-scrollbar-thumb-radius`, `--c-scrollbar-thumb-bg`, `--c-scrollbar-thumb-bg-hover`, `--c-scrollbar-thumb-bg-active`
- `--c-scrollbar-rail-bg`, `--c-scrollbar-transition`

### Modal 标题壳层实现

- `--modal-header-padding-y`
- `--modal-title-font-size`, `--modal-title-font-weight`, `--modal-title-line-height`

### Toast 壳层实现

- `--toast-status-color`, `--toast-status-bg`

---

## 变更日志

### v1.0.0 (2026-01-15)

- 初始版本
- 定义 Tier 1/2/3 分层结构
- 530 为初始版本记录，不能作为当前变量总数；当前核心/组件清单以 contract 源声明与上文同步，内部变量不计入稳定 API。
