# 前端权限与初始化

前端以服务端返回的用户、菜单和有效权限决定界面展示；所有打包代码仍可能被浏览器下载，隐藏菜单或路由不构成服务端授权。

## 正式入口

- [user store](../src/store/modules/user.js)：读取当前用户、菜单和权限，协调登录状态与失败恢复。
- [router](../src/router/index.js)及[routerFacade](../src/router/routerFacade.ts)：原有导航运行时，不使用旧 src/route/index.js 示例。
- [内置用户菜单](../src/common/menus/userMenuBuiltins.ts)：原注册入口，账号资料页也沿此机制进入。

初始化必须在用户、菜单、权限读取全部成功后提交登录状态。500、超时及网络失败不等于凭据已失效：清除本轮旧权限、保留可再次验证的 Token，并允许重试读取。明确刷新凭据无效或主动退出才清理会话；不能重放已消费的登录码或绑定操作。成功返回的空菜单与加载失败分别呈现。

菜单和权限的正式响应由后端模型/API定义；不在本页维护旧 router_id/authIds 表和手写菜单副本。有效权限、RBAC失败与委托边界统一见[安全设计](../../../../security/DESIGN.md#45-rbac-读取缓存与前端初始化)。前端规则与验证命令见[子树入口](../../AGENTS.md)。
